import type {
	PSTImportCredentials,
	EmailObject,
	EmailAddress,
	SyncState,
	MailboxUser,
} from '@open-archiver/types';
import type { IEmailConnector } from '../EmailProviderFactory';
import { PSTFile, PSTFolder, PSTMessage, PSTRecipient } from 'pst-extractor';
import { simpleParser, ParsedMail, Attachment, AddressObject } from 'mailparser';
import { logger } from '../../config/logger';
import { getThreadId } from './helpers/utils';
import { StorageService } from '../StorageService';
import { Readable } from 'stream';
import { createHash } from 'crypto';
import { join } from 'path';
import { createWriteStream, promises as fs } from 'fs';

// We have to hardcode names for deleted and trash folders here as current lib doesn't support looking into PST properties.
const DELETED_FOLDERS = new Set([
	// English
	'deleted items',
	'trash',
	// Spanish
	'elementos eliminados',
	'papelera',
	// French
	'éléments supprimés',
	'corbeille',
	// German
	'gelöschte elemente',
	'papierkorb',
	// Italian
	'posta eliminata',
	'cestino',
	// Portuguese
	'itens excluídos',
	'lixo',
	// Dutch
	'verwijderde items',
	'prullenbak',
	// Russian
	'удаленные',
	'корзина',
	// Polish
	'usunięte elementy',
	'kosz',
	// Japanese
	'削除済みアイテム',
	// Czech
	'odstraněná pošta',
	'koš',
	// Estonian
	'kustutatud kirjad',
	'prügikast',
	// Swedish
	'borttagna objekt',
	'skräp',
	// Danish
	'slettet post',
	'papirkurv',
	// Norwegian
	'slettede elementer',
	// Finnish
	'poistetut',
	'roskakori',
]);

const JUNK_FOLDERS = new Set([
	// English
	'junk email',
	'spam',
	// Spanish
	'correo no deseado',
	// French
	'courrier indésirable',
	// German
	'junk-e-mail',
	// Italian
	'posta indesiderata',
	// Portuguese
	'lixo eletrônico',
	// Dutch
	'ongewenste e-mail',
	// Russian
	'нежелательная почта',
	'спам',
	// Polish
	'wiadomości-śmieci',
	// Japanese
	'迷惑メール',
	'スパム',
	// Czech
	'nevyžádaná pošta',
	// Estonian
	'rämpspost',
	// Swedish
	'skräppost',
	// Danish
	'uønsket post',
	// Norwegian
	'søppelpost',
	// Finnish
	'roskaposti',
]);

export class PSTConnector implements IEmailConnector {
	private storage: StorageService;

	constructor(private credentials: PSTImportCredentials) {
		this.storage = new StorageService();
	}

	private async loadPstFile(): Promise<{ pstFile: PSTFile; tempDir: string }> {
		const fileStream = await this.storage.getStream(this.credentials.uploadedFilePath);
		const tempDir = await fs.mkdtemp(join('/tmp', `pst-import-${new Date().getTime()}`));
		const tempFilePath = join(tempDir, 'temp.pst');

		await new Promise<void>((resolve, reject) => {
			const dest = createWriteStream(tempFilePath);
			fileStream.pipe(dest);
			dest.on('finish', resolve);
			dest.on('error', reject);
		});

		const pstFile = new PSTFile(tempFilePath);
		return { pstFile, tempDir };
	}

	public async testConnection(): Promise<boolean> {
		try {
			if (!this.credentials.uploadedFilePath) {
				throw Error('PST file path not provided.');
			}
			if (!this.credentials.uploadedFilePath.includes('.pst')) {
				throw Error('Provided file is not in the PST format.');
			}
			const fileExist = await this.storage.exists(this.credentials.uploadedFilePath);
			if (!fileExist) {
				throw Error('PST file upload not finished yet, please wait.');
			}
			return true;
		} catch (error) {
			logger.error({ error, credentials: this.credentials }, 'PST file validation failed.');
			throw error;
		}
	}

	/**
	 * Lists mailboxes within the PST. It treats each top-level folder
	 * as a distinct mailbox, allowing it to handle PSTs that have been
	 * consolidated from multiple sources.
	 */
	public async *listAllUsers(): AsyncGenerator<MailboxUser> {
		let pstFile: PSTFile | null = null;
		let tempDir: string | null = null;
		try {
			const loadResult = await this.loadPstFile();
			pstFile = loadResult.pstFile;
			tempDir = loadResult.tempDir;
			const root = pstFile.getRootFolder();
			const displayName: string =
				root.displayName || pstFile.pstFilename || String(new Date().getTime());
			logger.info(`Found potential mailbox: ${displayName}`);
			const constructedPrimaryEmail = `${displayName.replace(/ /g, '.').toLowerCase()}@pst.local`;
			yield {
				id: constructedPrimaryEmail,
				// We will address the primaryEmail problem in the next section.
				primaryEmail: constructedPrimaryEmail,
				displayName: displayName,
			};
		} catch (error) {
			logger.error({ error }, 'Failed to list users from PST file.');
			throw error;
		} finally {
			pstFile?.close();
			if (tempDir) {
				await fs.rm(tempDir, { recursive: true, force: true });
			}
		}
	}

	public async *fetchEmails(
		userEmail: string,
		syncState?: SyncState | null
	): AsyncGenerator<EmailObject | null> {
		let pstFile: PSTFile | null = null;
		let tempDir: string | null = null;
		try {
			const loadResult = await this.loadPstFile();
			pstFile = loadResult.pstFile;
			tempDir = loadResult.tempDir;
			const root = pstFile.getRootFolder();
			yield* this.processFolder(root, '', userEmail);
		} catch (error) {
			logger.error({ error }, 'Failed to fetch email.');
			throw error;
		} finally {
			pstFile?.close();
			if (tempDir) {
				await fs.rm(tempDir, { recursive: true, force: true });
			}
			try {
				await this.storage.delete(this.credentials.uploadedFilePath);
			} catch (error) {
				logger.error(
					{ error, file: this.credentials.uploadedFilePath },
					'Failed to delete PST file after processing.'
				);
			}
		}
	}

	private async *processFolder(
		folder: PSTFolder,
		currentPath: string,
		userEmail: string
	): AsyncGenerator<EmailObject | null> {
		const folderName = folder.displayName.toLowerCase();
		if (DELETED_FOLDERS.has(folderName) || JUNK_FOLDERS.has(folderName)) {
			logger.info(`Skipping folder: ${folder.displayName}`);
			return;
		}

		const newPath = currentPath ? `${currentPath}/${folder.displayName}` : folder.displayName;

		if (folder.contentCount > 0) {
			let email: PSTMessage | null = folder.getNextChild();
			while (email != null) {
				yield await this.parseMessage(email, newPath, userEmail);
				try {
					email = folder.getNextChild();
				} catch (error) {
					console.warn("Folder doesn't have child");
					email = null;
				}
			}
		}

		if (folder.hasSubfolders) {
			for (const subFolder of folder.getSubFolders()) {
				yield* this.processFolder(subFolder, newPath, userEmail);
			}
		}
	}

	private async parseMessage(
		msg: PSTMessage,
		path: string,
		userEmail: string
	): Promise<EmailObject> {
		const emlContent = await this.constructEml(msg);
		const emlBuffer = Buffer.from(emlContent, 'utf-8');
		const parsedEmail: ParsedMail = await simpleParser(emlBuffer);

		const attachments = parsedEmail.attachments.map((attachment: Attachment) => ({
			filename: attachment.filename || 'untitled',
			contentType: attachment.contentType,
			size: attachment.size,
			content: attachment.content as Buffer,
		}));

		const mapAddresses = (
			addresses: AddressObject | AddressObject[] | undefined
		): EmailAddress[] => {
			if (!addresses) return [];
			const addressArray = Array.isArray(addresses) ? addresses : [addresses];
			return addressArray.flatMap((a) =>
				a.value.map((v) => ({
					name: v.name,
					address: v.address?.replaceAll(`'`, '') || '',
				}))
			);
		};

		const from = mapAddresses(parsedEmail.from);
		if (from.length === 0) {
			from.push({ name: 'No Sender', address: 'No Sender' });
		}

		const threadId = getThreadId(parsedEmail.headers);
		let messageId = msg.internetMessageId;
		// generate a unique ID for this message

		if (!messageId) {
			messageId = `generated-${createHash('sha256')
				.update(
					emlBuffer ?? Buffer.from(parsedEmail.text || parsedEmail.html || '', 'utf-8')
				)
				.digest('hex')}-${createHash('sha256')
				.update(emlBuffer ?? Buffer.from(msg.subject || '', 'utf-8'))
				.digest('hex')}-${msg.clientSubmitTime?.getTime()}`;
		}
		return {
			id: messageId,
			threadId: threadId,
			from,
			to: mapAddresses(parsedEmail.to),
			cc: mapAddresses(parsedEmail.cc),
			bcc: mapAddresses(parsedEmail.bcc),
			subject: parsedEmail.subject || '',
			body: parsedEmail.text || '',
			html: parsedEmail.html || '',
			headers: parsedEmail.headers,
			attachments,
			receivedAt: parsedEmail.date || new Date(),
			eml: emlBuffer,
			path,
		};
	}

	/**
	 * Returns true if the address looks like an Exchange X500 DN
	 * (e.g. /O=ORG/OU=.../CN=RECIPIENTS/CN=USER).
	 */
	private static isX500Address(addr: string): boolean {
		return addr.startsWith('/O=') || addr.startsWith('/o=');
	}

	/**
	 * Extracts the last CN value from an X500 path as a rough display name.
	 * "/O=CITY/OU=.../CN=RECIPIENTS/CN=NLINDHAG" → "NLINDHAG"
	 */
	private static extractCnFromX500(addr: string): string {
		const match = addr.match(/\/CN=([^/]+)$/i);
		return match ? match[1] : '';
	}

	/**
	 * Resolves an SMTP email address for the sender.
	 * PST files from Exchange store internal X500 addresses instead of SMTP.
	 * Falls back to senderName or extracted CN when only an X500 address is available.
	 */
	private resolveSenderSmtpAddress(msg: PSTMessage): string {
		// Prefer explicit SMTP addresses
		if (msg.senderAddrtype?.toUpperCase() === 'SMTP' && msg.senderEmailAddress) {
			return msg.senderEmailAddress;
		}
		if (
			msg.sentRepresentingAddressType?.toUpperCase() === 'SMTP' &&
			msg.sentRepresentingEmailAddress
		) {
			return msg.sentRepresentingEmailAddress;
		}
		if (msg.returnPath) {
			return msg.returnPath;
		}

		// If the raw address is X500, don't use it as-is
		const rawAddr = msg.senderEmailAddress || '';
		if (!PSTConnector.isX500Address(rawAddr)) {
			return rawAddr;
		}

		// X500 fallback: use senderName if it looks like an email, otherwise
		// construct a placeholder from the CN or the display name
		if (msg.senderName && msg.senderName.includes('@')) {
			return msg.senderName;
		}

		const cn = PSTConnector.extractCnFromX500(rawAddr);
		const displayName = msg.senderName || cn || 'unknown';
		logger.debug(
			{ x500: rawAddr, senderName: msg.senderName, cn },
			'Sender has X500 address, using display name as fallback'
		);
		return displayName;
	}

	/**
	 * Resolves recipients from the PST recipient table, preferring SMTP addresses over X500.
	 */
	private resolveRecipients(msg: PSTMessage): {
		toList: string[];
		ccList: string[];
		bccList: string[];
	} {
		const toList: string[] = [];
		const ccList: string[] = [];
		const bccList: string[] = [];

		try {
			for (let i = 0; i < msg.numberOfRecipients; i++) {
				const recipient = msg.getRecipient(i);
				if (!recipient) continue;

				const rawEmail = recipient.smtpAddress || recipient.emailAddress || '';
				const name = recipient.displayName || '';

				// Skip X500 addresses — use display name instead
				const email = PSTConnector.isX500Address(rawEmail) ? '' : rawEmail;

				let formatted: string;
				if (name && email) {
					formatted = `"${name.replace(/"/g, '\\"')}" <${email}>`;
				} else if (email) {
					formatted = email;
				} else if (name) {
					// No usable email — use display name (will be parsed as name-only by mailparser)
					formatted = name;
				} else {
					continue;
				}

				switch (recipient.recipientType) {
					case 1:
						toList.push(formatted);
						break;
					case 2:
						ccList.push(formatted);
						break;
					case 3:
						bccList.push(formatted);
						break;
					default:
						toList.push(formatted);
						break;
				}
			}
		} catch (error) {
			logger.warn(
				{ error },
				'Failed to resolve recipients from PST recipient table, falling back to display fields'
			);
		}

		// Fall back to display fields if recipient table was empty or failed
		if (toList.length === 0 && msg.displayTo) {
			toList.push(msg.displayTo);
		}
		if (ccList.length === 0 && msg.displayCC) {
			ccList.push(msg.displayCC);
		}
		if (bccList.length === 0 && msg.displayBCC) {
			bccList.push(msg.displayBCC);
		}

		return { toList, ccList, bccList };
	}

	private async constructEml(msg: PSTMessage): Promise<string> {
		const boundary = '----boundary-openarchiver';
		const altBoundary = '----boundary-openarchiver_alt';

		const senderEmail = this.resolveSenderSmtpAddress(msg);
		const { toList, ccList, bccList } = this.resolveRecipients(msg);

		// Build headers
		let headers = '';
		if (msg.senderName || senderEmail) {
			headers += `From: "${(msg.senderName || '').replace(/"/g, '\\"')}" <${senderEmail}>\r\n`;
		}
		if (toList.length > 0) {
			headers += `To: ${toList.join(', ')}\r\n`;
		}
		if (ccList.length > 0) {
			headers += `Cc: ${ccList.join(', ')}\r\n`;
		}
		if (bccList.length > 0) {
			headers += `Bcc: ${bccList.join(', ')}\r\n`;
		}
		if (msg.subject) {
			headers += `Subject: ${msg.subject}\r\n`;
		}
		if (msg.clientSubmitTime) {
			headers += `Date: ${new Date(msg.clientSubmitTime).toUTCString()}\r\n`;
		}
		if (msg.internetMessageId) {
			headers += `Message-ID: <${msg.internetMessageId}>\r\n`;
		}
		if (msg.inReplyToId) {
			headers += `In-Reply-To: ${msg.inReplyToId}\r\n`;
		}
		if (msg.conversationId) {
			headers += `Conversation-Id: ${msg.conversationId}\r\n`;
		}
		headers += 'MIME-Version: 1.0\r\n';

		const hasBody = !!msg.body;
		const hasHtml = !!msg.bodyHTML;

		// Build the alternative part (body text + html)
		let altPart = '';
		if (hasBody) {
			altPart += `--${altBoundary}\r\n`;
			altPart += 'Content-Type: text/plain; charset="utf-8"\r\n\r\n';
			altPart += `${msg.body}\r\n\r\n`;
		}
		if (hasHtml) {
			altPart += `--${altBoundary}\r\n`;
			altPart += 'Content-Type: text/html; charset="utf-8"\r\n\r\n';
			altPart += `${msg.bodyHTML}\r\n\r\n`;
		}
		if (hasBody || hasHtml) {
			altPart += `--${altBoundary}--\r\n`;
		}

		if (msg.hasAttachments) {
			// multipart/mixed wrapping multipart/alternative + attachments
			headers += `Content-Type: multipart/mixed; boundary="${boundary}"\r\n`;
			let eml = headers + '\r\n';

			// First part: the body as multipart/alternative
			eml += `--${boundary}\r\n`;
			eml += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n\r\n`;
			eml += altPart;

			// Attachment parts
			for (let i = 0; i < msg.numberOfAttachments; i++) {
				const attachment = msg.getAttachment(i);
				const attachmentStream = attachment.fileInputStream;
				if (attachmentStream) {
					const attachmentBuffer = Buffer.alloc(attachment.filesize);
					attachmentStream.readCompletely(attachmentBuffer);
					eml += `--${boundary}\r\n`;
					eml += `Content-Type: ${attachment.mimeTag}; name="${attachment.longFilename}"\r\n`;
					eml += `Content-Disposition: attachment; filename="${attachment.longFilename}"\r\n`;
					eml += 'Content-Transfer-Encoding: base64\r\n\r\n';
					eml += `${attachmentBuffer.toString('base64')}\r\n`;
				}
			}
			eml += `--${boundary}--\r\n`;
			return eml;
		} else {
			// No attachments: simple multipart/alternative
			headers += `Content-Type: multipart/alternative; boundary="${altBoundary}"\r\n`;
			let eml = headers + '\r\n';
			eml += altPart;
			return eml;
		}
	}

	public getUpdatedSyncState(): SyncState {
		return {};
	}
}

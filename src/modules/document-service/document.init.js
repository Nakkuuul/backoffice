import { logger } from '../../shared/utils/logger.js';
import { registerDocumentSource } from '../esign-service/ports/index.js';
import { getFile } from './document.service.js';

/**
 * Register document-service as the DocumentSource for esign-service, fulfilling
 * the port esign-service already defines. Now esign `documentRef`-based signing
 * pulls real stored documents from here (ref = document id).
 */
export function initDocumentService() {
  registerDocumentSource({
    async getDocument(ref) {
      const f = await getFile(ref);
      return { buffer: f.buffer, name: f.filename, contentType: f.contentType };
    },
  });
  logger.info('documents: registered as esign-service DocumentSource');
}

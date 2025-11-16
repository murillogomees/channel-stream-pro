// Core exports
export { NotificationService } from './core/NotificationService';
export { TemplateEngine } from './core/TemplateEngine';
export { WhatsAppAdapter } from './core/WhatsAppAdapter';

// Detector exports
export { PaymentDetector } from './detectors/PaymentDetector';
export { NewClientDetector } from './detectors/NewClientDetector';
export { ClientChangeDetector } from './detectors/ClientChangeDetector';

// Handler exports
export { EventNotificationHandler } from './handlers/EventNotificationHandler';
export { UpdateNotificationHandler } from './handlers/UpdateNotificationHandler';
export { DueDateNotificationHandler } from './handlers/DueDateNotificationHandler';

// Re-export types
export type { SendNotificationOptions } from './core/NotificationService';
export type { ClientChange } from './detectors/ClientChangeDetector';

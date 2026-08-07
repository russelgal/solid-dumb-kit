export { DumbModal, type DumbModalProps } from './DumbModal';
/**
 * Вопрос, заданный окном: `modal.confirm('Удалить безвозвратно?')`. Плашка в
 * углу (`toast.confirm`) — для случаев, когда работа продолжается; здесь она
 * встала и ответ обязателен.
 */
export { DumbModalHost, type DumbModalHostProps } from './DumbModalHost';
export { modal, createModalBus, type ModalAction, type ModalAskOptions, type ModalBus, type ModalQuestion, } from './modalBus';

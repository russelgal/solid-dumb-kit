import { type ModalBus } from './modalBus';
export type DumbModalHostProps = {
    /** своя шина; не задана — общая */
    bus?: ModalBus;
    class?: string;
};
export declare function DumbModalHost(props: DumbModalHostProps): import("solid-js").JSX.Element;

import type { ComponentChildren } from 'preact';

export function Modal({
  title,
  children,
  onClose,
  closeLabel = 'Continue',
}: {
  title: string;
  children: ComponentChildren;
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <div class="modal-backdrop" role="dialog" aria-modal="true" aria-label={title}>
      <div class="modal">
        <h2>{title}</h2>
        <div class="modal-body">{children}</div>
        <button class="primary" onClick={onClose} autofocus>
          {closeLabel}
        </button>
      </div>
    </div>
  );
}

export function StoryModal(props: {
  title: string;
  paragraphs: readonly string[];
  onClose: () => void;
  closeLabel?: string;
}) {
  return (
    <Modal title={props.title} onClose={props.onClose} closeLabel={props.closeLabel}>
      {props.paragraphs.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </Modal>
  );
}

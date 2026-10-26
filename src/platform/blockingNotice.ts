import { theme } from '../ui/theme';

export interface BlockingNotice {
  /** The element id, so a second call with the same id does nothing. */
  id: string;
  title: string;
  body: string;
  actionLabel: string;
  /**
   * The button's action. A promise that resolves false (or rejects) re-enables
   * the button, for a retry that did not succeed.
   */
  onAction: () => Promise<boolean> | void;
}

/**
 * A full-page notice in plain DOM, shown instead of the game: the tab guard
 * and the newer-save stop. Plain DOM is deliberate, since a stopped boot should
 * not load Phaser or its assets merely to display a message.
 */
export function showBlockingNotice(notice: BlockingNotice): void {
  if (document.getElementById(notice.id)) return;

  const root = document.createElement('main');
  root.id = notice.id;
  root.setAttribute('role', 'alertdialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', `${notice.id}-title`);
  Object.assign(root.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '1100',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxSizing: 'border-box',
    padding: '24px',
    background: theme.colors.dim,
    color: theme.colors.body,
    fontFamily: theme.fonts.ui,
    textAlign: 'center',
  });

  const panel = document.createElement('section');
  Object.assign(panel.style, {
    width: 'min(440px, 100%)',
    boxSizing: 'border-box',
    padding: '36px 32px',
    border: `${theme.control.borderWidth}px solid ${theme.colors.panelStroke}`,
    borderRadius: `${theme.radius.panel}px`,
    background: theme.colors.panelFill,
    boxShadow: `0 18px 60px ${theme.colors.dim}`,
  });

  const title = document.createElement('h1');
  title.id = `${notice.id}-title`;
  title.textContent = notice.title;
  Object.assign(title.style, {
    margin: '0 0 16px',
    color: theme.colors.heading,
    fontFamily: theme.fonts.display,
    fontSize: `${theme.type.display}px`,
    fontWeight: theme.weight.w700,
    lineHeight: '1.1',
  });

  const body = document.createElement('p');
  body.textContent = notice.body;
  Object.assign(body.style, {
    margin: '0 auto 28px',
    maxWidth: '360px',
    color: theme.colors.body,
    fontSize: `${theme.type.body}px`,
    lineHeight: '1.5',
  });

  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = notice.actionLabel;
  Object.assign(button.style, {
    minWidth: '132px',
    minHeight: `${theme.control.minHitHeight}px`,
    padding: '0 20px',
    border: `${theme.control.borderWidth}px solid ${theme.colors.goldHover}`,
    borderRadius: `${theme.radius.control}px`,
    background: theme.colors.btnPrimaryBg,
    color: theme.colors.onGold,
    cursor: 'pointer',
    fontFamily: theme.fonts.ui,
    fontSize: `${theme.type.label}px`,
    fontWeight: theme.weight.w700,
  });
  button.addEventListener('focus', () => {
    button.style.outline = `2px solid ${theme.colors.goldHover}`;
    button.style.outlineOffset = '3px';
  });
  button.addEventListener('blur', () => {
    button.style.outline = 'none';
  });
  button.addEventListener('click', () => {
    button.disabled = true;
    const result = notice.onAction();
    if (!result) return;
    void result.then((done) => {
      if (!done) button.disabled = false;
    }, () => {
      button.disabled = false;
    });
  });

  panel.append(title, body, button);
  root.append(panel);
  document.body.append(root);
}

import Phaser from 'phaser';
import { CardView } from './CardView';

/** While open, disables a set of underlying interactive objects; restores on close. */
export class ModalGuard {
  private disabled: Phaser.GameObjects.GameObject[] = [];

  open(objects: Iterable<Phaser.GameObjects.GameObject>): void {
    for (const obj of objects) {
      if (obj instanceof CardView) {
        obj.disableInput();
        this.disabled.push(obj);
      } else if (obj.input && obj.input.enabled) {
        obj.disableInteractive();
        this.disabled.push(obj);
      }
    }
  }

  close(): void {
    for (const obj of this.disabled) {
      if (!obj.scene) continue; // destroyed while guarded (declarative re-renders)
      if (obj instanceof CardView) obj.enableInput();
      else obj.setInteractive();
    }
    this.disabled = [];
  }
}

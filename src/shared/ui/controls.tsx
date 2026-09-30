import { Button as BaseButton } from '@base-ui/react/button';
import { Input as BaseInput } from '@base-ui/react/input';
import { Avatar as BaseAvatar } from '@base-ui/react/avatar';
import type { ComponentProps, CSSProperties } from 'react';
import styles from './ui.module.css';

export function Button({
  className = '',
  ...props
}: ComponentProps<typeof BaseButton>) {
  return <BaseButton className={`${styles.button} ${className}`} {...props} />;
}

export function Input({
  className = '',
  ...props
}: ComponentProps<typeof BaseInput>) {
  return <BaseInput className={`${styles.input} ${className}`} {...props} />;
}

export function Avatar({
  name,
  src,
  small = false,
}: {
  name: string;
  src?: string;
  small?: boolean;
}) {
  const hue =
    [...name].reduce((total, letter) => total + letter.charCodeAt(0), 0) % 360;

  return (
    <BaseAvatar.Root
      className={`${styles.avatar} ${small ? styles.small : ''}`}
      style={{ '--avatar-hue': hue } as CSSProperties}
    >
      <BaseAvatar.Image
        src={src || undefined}
        alt=""
        className={styles.avatarImage}
      />
      <BaseAvatar.Fallback className={styles.avatarFallback}>
        {name
          .trim()
          .split(/\s+/)
          .slice(0, 2)
          .map((part) => part[0])
          .join('')
          .toUpperCase() || '?'}
      </BaseAvatar.Fallback>
    </BaseAvatar.Root>
  );
}

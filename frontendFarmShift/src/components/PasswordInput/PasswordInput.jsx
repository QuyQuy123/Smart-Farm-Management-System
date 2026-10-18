import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import styles from './PasswordInput.module.css';

export const PasswordInput = ({ visibilityLabel = 'mật khẩu', style, ...props }) => {
  const [visible, setVisible] = useState(false);
  const actionLabel = `${visible ? 'Ẩn' : 'Hiện'} ${visibilityLabel}`;

  return (
    <div className={styles.wrapper}>
      <input {...props} type={visible ? 'text' : 'password'} style={{ ...style, paddingRight: '46px' }} />
      <button type="button" className={styles.toggle} aria-label={actionLabel} title={actionLabel}
        aria-controls={props.id} aria-pressed={visible} disabled={props.disabled}
        onMouseDown={event => event.preventDefault()}
        onClick={() => setVisible(current => !current)}>
        {visible ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X } from 'lucide-react';
import { Button } from '../../components/Button/Button';
import styles from './AvatarCropperModal.module.css';

function centerAspectCrop(mediaWidth, mediaHeight, aspect) {
  return centerCrop(
    makeAspectCrop(
      {
        unit: '%',
        width: 90,
      },
      aspect,
      mediaWidth,
      mediaHeight,
    ),
    mediaWidth,
    mediaHeight,
  );
}

export const AvatarCropperModal = ({ imageSrc, onClose, onCropComplete }) => {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState(null);
  const imgRef = useRef(null);

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    setCrop(centerAspectCrop(width, height, 1));
  };

  const handleSave = async () => {
    if (!completedCrop || !imgRef.current) {
      if (imageSrc) {
        onCropComplete(imageSrc, null);
      }
      return;
    }

    const canvas = document.createElement('canvas');
    const image = imgRef.current;
    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;
    
    canvas.width = Math.max(1, Math.floor(completedCrop.width * scaleX));
    canvas.height = Math.max(1, Math.floor(completedCrop.height * scaleY));
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(
      image,
      completedCrop.x * scaleX,
      completedCrop.y * scaleY,
      completedCrop.width * scaleX,
      completedCrop.height * scaleY,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const base64Image = canvas.toDataURL('image/jpeg', 0.92);
    canvas.toBlob((blob) => {
      const file = blob ? new File([blob], `avatar-${Date.now()}.jpg`, { type: 'image/jpeg' }) : null;
      onCropComplete(base64Image, file);
    }, 'image/jpeg', 0.92);
  };

  if (!imageSrc) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2 className={styles.title}>Cắt & Căn chỉnh ảnh đại diện</h2>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
            <X size={20} />
          </button>
        </div>
        
        <div className={styles.body}>
          <div className={styles.cropContainer}>
            <ReactCrop
              crop={crop}
              onChange={(_, percentCrop) => setCrop(percentCrop)}
              onComplete={(c) => setCompletedCrop(c)}
              aspect={1}
              circularCrop={true}
              keepSelection={true}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Cắt ảnh"
                onLoad={onImageLoad}
                className={styles.image}
              />
            </ReactCrop>
          </div>
          <p style={{ fontSize: '13px', color: 'var(--color-muted)', margin: 0, textAlign: 'center' }}>
            Kéo hoặc co giãn khung tròn để căn góc đại diện phù hợp nhất.
          </p>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="secondary" onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="button" onClick={handleSave}>
            Cắt & Lưu ảnh
          </Button>
        </div>
      </div>
    </div>
  );
};

import React, { useState, useRef } from 'react';
import ReactCrop, { centerCrop, makeAspectCrop, convertToPixelCrop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import { X, Crop, Check, Move } from 'lucide-react';
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
    const initialCrop = centerAspectCrop(width, height, 1);
    setCrop(initialCrop);
    setCompletedCrop(convertToPixelCrop(initialCrop, width, height));
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
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="avatar-crop-title" aria-describedby="avatar-crop-description" onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.headingIcon}><Crop size={21} /></span>
            <div>
              <h2 id="avatar-crop-title" className={styles.title}>Chỉnh ảnh đại diện</h2>
              <p id="avatar-crop-description" className={styles.subtitle}>Chọn góc ảnh bạn yêu thích</p>
            </div>
          </div>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Đóng">
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
          <p className={styles.hint}>
            <Move size={16} aria-hidden="true" /> Kéo để di chuyển, kéo các góc để điều chỉnh khung ảnh.
          </p>
        </div>

        <div className={styles.footer}>
          <Button type="button" variant="secondary" className={styles.cancelBtn} onClick={onClose}>
            Hủy bỏ
          </Button>
          <Button type="button" variant="green" className={styles.saveBtn} disabled={!completedCrop?.width || !completedCrop?.height} onClick={handleSave}>
            <Check size={17} /> Cắt & lưu ảnh
          </Button>
        </div>
      </div>
    </div>
  );
};

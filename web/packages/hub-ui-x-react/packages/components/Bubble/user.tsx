import React, { useState } from "react";
import { createPortal } from "react-dom";
import { formatFileSize } from "../../utils";
import FileIcon from "../FileIcon/index";
import "./user.css";

interface FileItem {
  id: string;
  filename: string;
  url: string;
  size: number;
  mime_type: string;
}

export interface BubbleUserProps {
  content?: string;
  files?: FileItem[];
  avatar?: string;
  header?: React.ReactNode;
  fileSlot?: React.ReactNode;
  contentSlot?: React.ReactNode;
  contentBefore?: React.ReactNode;
  contentAfter?: React.ReactNode;
  footer?: React.ReactNode;
  menu?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

const BubbleUser: React.FC<BubbleUserProps> = ({
  content = "",
  files = [],
  avatar = "",
  header,
  fileSlot,
  contentSlot,
  contentBefore,
  contentAfter,
  footer,
  menu,
  className,
  style,
}) => {
  const [showImageViewer, setShowImageViewer] = useState(false);
  const [currentImage, setCurrentImage] = useState("");

  const openImageViewer = (imageUrl: string) => {
    setCurrentImage(imageUrl);
    setShowImageViewer(true);
  };

  const closeImageViewer = () => {
    setShowImageViewer(false);
  };

  const handleFileClick = (file: FileItem) => {
    window.open(file.url, "_blank");
  };

  return (
    <div className={`x-bubble ${className || ""}`} style={style}>
      <div className="x-bubble__container">
        {header}

        {fileSlot ||
          (files.length > 0 && (
            <div className="x-bubble__file">
              {files.map((file) =>
                file.mime_type.startsWith("image") ? (
                  <div key={file.id} className="x-bubble__image">
                    <img
                      className="x-bubble__image-preview"
                      onClick={() => openImageViewer(file.url)}
                      src={file.url}
                      loading="lazy"
                      alt=""
                    />
                  </div>
                ) : (
                  <div
                    key={file.id}
                    className="x-bubble__file-item"
                    onClick={() => handleFileClick(file)}
                  >
                    <div className="x-bubble__file-icon">
                      <FileIcon
                        name={file.filename}
                        mimeType={file.mime_type}
                      />
                    </div>
                    <div className="x-bubble__file-info">
                      <div className="x-bubble__file-name">{file.filename}</div>
                      <div className="x-bubble__file-size">
                        {formatFileSize(file.size)}
                      </div>
                    </div>
                  </div>
                ),
              )}
            </div>
          ))}

        <div className="x-bubble__message-container">
          {contentSlot ||
            (content && (
              <div className="x-bubble__message">
                <p className="x-bubble__message-content">
                  {contentBefore}
                  {content}
                  {contentAfter}
                </p>
              </div>
            ))}
          {avatar && (
            <div className="x-bubble__avatar">
              <img src={avatar} alt="User" />
            </div>
          )}
        </div>

        {footer}

        <div className="x-bubble__menu x-bubble__menu--hidden">{menu}</div>
      </div>

      {showImageViewer &&
        createPortal(
          <div className="x-image-viewer" onClick={closeImageViewer}>
            <div
              className="x-image-viewer__content"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={currentImage}
                loading="lazy"
                alt=""
                className="x-image-viewer__img"
              />
            </div>
            <button
              className="x-image-viewer__close"
              onClick={closeImageViewer}
            >
              ×
            </button>
          </div>,
          document.body,
        )}
    </div>
  );
};

BubbleUser.displayName = "xBubbleUser";

export default BubbleUser;

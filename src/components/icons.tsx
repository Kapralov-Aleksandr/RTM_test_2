// ============================================================
// Иконки приложения — inline SVG (stroke, 24x24)
// ============================================================

import type { ReactNode, SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(children: ReactNode) {
  return function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        {...rest}
      >
        {children}
      </svg>
    );
  };
}

/** Логотип: узлы трассировки, связанные цепочкой */
export const IconLogo = make(
  <>
    <circle cx="5" cy="6" r="2.4" />
    <circle cx="19" cy="6" r="2.4" />
    <circle cx="12" cy="18" r="2.4" />
    <path d="M7.4 6.6 10 15.8M16.6 6.6 14 15.8M7.4 6h9.2" />
  </>,
);

export const IconGrid = make(
  <>
    <rect x="3.5" y="3.5" width="17" height="17" rx="2" />
    <path d="M3.5 9.2h17M3.5 14.8h17M9.2 3.5v17M14.8 3.5v17" />
  </>,
);

export const IconDiff = make(
  <>
    <path d="M12 3v18" strokeDasharray="3 2.4" />
    <path d="M8 7H4.5v10H8M8 9.5 5.8 12 8 14.5" />
    <path d="M16 7h3.5v10H16M16 9.5 18.2 12 16 14.5" />
  </>,
);

export const IconFunnel = make(
  <>
    <path d="M4 5h16l-6 7.5V19l-4 1.6v-8.1L4 5Z" />
  </>,
);

export const IconPlus = make(<path d="M12 5v14M5 12h14" />);
export const IconDownload = make(
  <>
    <path d="M12 4v10M8 10.5 12 14.5l4-4" />
    <path d="M4.5 16.5v2.5A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
  </>,
);
export const IconUpload = make(
  <>
    <path d="M12 14.5V4.5M8 8.5l4-4 4 4" />
    <path d="M4.5 16.5v2.5A1.5 1.5 0 0 0 6 20.5h12a1.5 1.5 0 0 0 1.5-1.5v-2.5" />
  </>,
);
export const IconCheck = make(<path d="M4.5 12.5 9.5 17.5 19.5 6.5" />);
export const IconX = make(<path d="M6 6l12 12M18 6 6 18" />);
export const IconAlert = make(
  <>
    <path d="M12 4 2.8 19.5h18.4L12 4Z" />
    <path d="M12 10v4.2M12 17.2v.1" />
  </>,
);
export const IconInfo = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5M12 8v.1" />
  </>,
);
export const IconSave = make(
  <>
    <path d="M5 4.5h11L19.5 8v11A1.5 1.5 0 0 1 18 20.5H6A1.5 1.5 0 0 1 4.5 19V6A1.5 1.5 0 0 1 6 4.5Z" />
    <path d="M8 4.5V9h7V4.5M8 20v-6h8v6" />
  </>,
);
export const IconSearch = make(
  <>
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4.5 4.5" />
  </>,
);
export const IconRefresh = make(
  <>
    <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
    <path d="M19.7 3.5v4h-4" />
  </>,
);
export const IconDoc = make(
  <>
    <path d="M6 3.5h8L18.5 8v11A1.5 1.5 0 0 1 17 20.5H6A1.5 1.5 0 0 1 4.5 19V5A1.5 1.5 0 0 1 6 3.5Z" />
    <path d="M14 3.5V8h4.5M8 12h8M8 15.5h8M8 8.5h3" />
  </>,
);
export const IconClock = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.5V12l3.2 2" />
  </>,
);
export const IconLink = make(
  <>
    <path d="M10 14a4.5 4.5 0 0 0 6.4.4l2.4-2.4a4.5 4.5 0 0 0-6.4-6.4L11 7" />
    <path d="M14 10a4.5 4.5 0 0 0-6.4-.4l-2.4 2.4a4.5 4.5 0 0 0 6.4 6.4L13 17" />
  </>,
);
export const IconGear = make(
  <>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3.5v2M12 18.5v2M3.5 12h2M18.5 12h2M6 6l1.4 1.4M16.6 16.6 18 18M18 6l-1.4 1.4M7.4 16.6 6 18" />
  </>,
);
export const IconTrash = make(
  <>
    <path d="M5 7h14M9.5 7V5.5A1.5 1.5 0 0 1 11 4h2a1.5 1.5 0 0 1 1.5 1.5V7" />
    <path d="M7 7l.8 12A1.5 1.5 0 0 0 9.3 20.5h5.4a1.5 1.5 0 0 0 1.5-1.5L17 7M10.2 11v5.5M13.8 11v5.5" />
  </>,
);
export const IconChevron = make(<path d="m7 10 5 5 5-5" />);
export const IconLock = make(
  <>
    <rect x="5.5" y="10.5" width="13" height="9.5" rx="1.5" />
    <path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" />
  </>,
);
export const IconBook = make(
  <>
    <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5h13v15h-13a2 2 0 0 0-2 2v-15Z" />
    <path d="M4.5 20.5v-15M8.5 3.5v15M12 8h5" />
  </>,
);
export const IconJira = make(
  <>
    <path d="M12 3.5 5 10.5l7 7 7-7-7-7Z" />
    <path d="m8.5 14 -3.5 3.5L12 21l7-3.5L15.5 14 12 17.5 8.5 14Z" />
  </>,
);
export const IconTarget = make(
  <>
    <circle cx="12" cy="12" r="8.5" />
    <circle cx="12" cy="12" r="4.5" />
    <circle cx="12" cy="12" r="0.8" fill="currentColor" />
  </>,
);
export const IconBolt = make(<path d="M13 3 5 13.5h5L11 21l8-10.5h-5L13 3Z" />);
export const IconEye = make(
  <>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
    <circle cx="12" cy="12" r="3" />
  </>,
);

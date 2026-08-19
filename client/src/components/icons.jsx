const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
};

export const HomeIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M3 10.5 12 3l9 7.5" />
    <path d="M5 9.5V21h14V9.5" />
    <path d="M10 21v-6h4v6" />
  </svg>
);

export const NewsIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="15" height="16" rx="2" />
    <path d="M18 9h2a1 1 0 0 1 1 1v9a2 2 0 0 1-2 2H5" />
    <path d="M7 9h7M7 13h7M7 17h4" />
  </svg>
);

export const BriefcaseIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
    <path d="M3 12.5h18" />
  </svg>
);

export const SettingsIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const SunIcon = (props) => (
  <svg {...base} {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
  </svg>
);

export const MoonIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
  </svg>
);

export const ExternalLinkIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="M7 17 17 7" />
    <path d="M8 7h9v9" />
  </svg>
);

export const CloseIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

export const MapPinIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

export const MailIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="5" width="18" height="14" rx="2" />
    <path d="m3 7 9 6 9-6" />
  </svg>
);

export const CopyIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <rect x="9" y="9" width="11" height="11" rx="2" />
    <path d="M5 15V5a2 2 0 0 1 2-2h8" />
  </svg>
);

export const CheckIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const DownloadIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="M12 3v12" />
    <path d="m7 11 5 5 5-5" />
    <path d="M5 21h14" />
  </svg>
);

// A signed document — used for the Freelance / contract-work section.
export const ContractIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7 3h8l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M15 3v4h4" />
    <path d="M8 13.5 10.5 16 16 10" />
  </svg>
);

export const PlayIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M6 4.5v15l14-7.5-14-7.5z" />
  </svg>
);

export const StopIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="5" y="5" width="14" height="14" rx="1.5" />
  </svg>
);

export const SpinnerIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M12 3a9 9 0 1 0 9 9" />
  </svg>
);

export const RotateCcwIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <path d="M3 12a9 9 0 1 0 2.6-6.36" />
    <path d="M3 4v5h5" />
  </svg>
);

export const TrashIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <path d="M4 7h16" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
    <path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3" />
  </svg>
);

export const SearchIcon = (props) => (
  <svg {...base} width={14} height={14} {...props}>
    <circle cx="10.5" cy="10.5" r="6.5" />
    <path d="M20 20l-4.35-4.35" />
  </svg>
);

export const UploadIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="M12 21V9" />
    <path d="m7 13 5-5 5 5" />
    <path d="M5 21h14" />
  </svg>
);

export const SheetIcon = (props) => (
  <svg {...base} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 9h18M3 14h18M9 4v16M15 4v16" />
  </svg>
);

export const FileIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    <path d="M14 3v4h4" />
  </svg>
);

export const AlertIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5" />
    <path d="M12 16h.01" />
  </svg>
);

export const ClockIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);

export const SkipIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="M5 5v14l9-7-9-7z" />
    <path d="M18 5v14" />
  </svg>
);

export const ShieldCheckIcon = (props) => (
  <svg {...base} width={16} height={16} {...props}>
    <path d="M12 3l8 3v6c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V6l8-3z" />
    <path d="M9 12l2.2 2.2L15.5 10" />
  </svg>
);

export const SendIcon = (props) => (
  <svg {...base} {...props}>
    <path d="M22 2 11 13" />
    <path d="M22 2 15 22l-4-9-9-4 20-7z" />
  </svg>
);

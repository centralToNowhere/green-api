export function Icon({
  name,
  size = 24,
}: {
  name: 'menu' | 'search' | 'send' | 'back' | 'logout' | 'close' | 'chat';
  size?: number;
}) {
  const paths = {
    menu: 'M4 6h16M4 12h16M4 18h16',
    search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    send: 'm22 2-7 20-4-9-9-4L22 2ZM22 2 11 13',
    back: 'm12 4-8 8 8 8M4 12h16',
    logout: 'M10 4H4v16h6M14 8l4 4-4 4M8 12h13',
    close: 'm6 6 12 12M6 18 18 6',
    chat: 'M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2-5a8.5 8.5 0 1 1 16-3.5Z',
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}

export function TelegramLogo() {
  return (
    <svg viewBox="0 0 160 160" aria-hidden="true">
      <defs>
        <linearGradient id="telegram-blue" x2="0" y2="1">
          <stop stopColor="#2aabee" />
          <stop offset="1" stopColor="#229ed9" />
        </linearGradient>
      </defs>
      <circle cx="80" cy="80" r="80" fill="url(#telegram-blue)" />
      <path
        d="M37 77 113 47c8-3 11 2 9 10l-13 62c-1 6-5 8-10 4L79 108l-10 10c-2 2-4 3-5-1l-7-23-20-6c-7-2-7-8 0-11Zm23 14 6 19 3-15 36-34c2-2 0-3-2-2L60 91Z"
        fill="white"
      />
    </svg>
  );
}

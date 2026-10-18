const paths = {
  eye: 'M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  eyeOff:
    'M3 3l18 18 M9 5.5A12 12 0 0 1 12 5c7 0 10 7 10 7a18 18 0 0 1-3 4 M6 6a18 18 0 0 0-4 6s3 7 10 7a12 12 0 0 0 5-1 M10 10a3 3 0 0 0 4 4',
  mesas: 'M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z',
  menu: 'M4 4h6a2 2 0 0 1 2 2v15a3 3 0 0 0-3-2H4z M20 4h-6a2 2 0 0 0-2 2 M20 4v15h-5',
  pedidos: 'M8 3h8v4H8z M8 5H5v16h14V5h-3 M8 11h8 M8 15h5',
  cocina: 'M7 14a5 5 0 1 1 1-9 5 5 0 0 1 8 0 5 5 0 1 1 1 9v7H7z M7 17h10',
  admin: 'M4 20V10h4v10 M10 20V4h4v16 M16 20v-7h4v7',
  historial: 'M3 11a9 9 0 1 1 2 7 M3 4v7h7 M12 7v6l4 2',
  usuarios:
    'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M20 21v-2a4 4 0 0 0-3-4 M17 3a4 4 0 0 1 0 8',
} as const
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  )
}

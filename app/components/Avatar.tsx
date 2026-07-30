export default function Avatar({
  initials,
  color,
  small = false,
  src,
}: {
  initials: string;
  color: string;
  small?: boolean;
  src?: string | null;
}) {
  return (
    <span className={`avatar ${small ? "avatar-small" : ""}`} style={{ background: color }}>
      {src ? <img src={src} alt="" /> : initials}
    </span>
  );
}

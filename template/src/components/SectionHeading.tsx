export default function SectionHeading({
  eyebrow,
  title,
  subtitle,
  align = 'center',
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  align?: 'center' | 'left';
}) {
  const alignCls = align === 'center' ? 'text-center mx-auto' : 'text-left';
  return (
    <div className={`max-w-2xl ${alignCls}`}>
      {eyebrow && (
        <span className="inline-block text-sm font-semibold uppercase tracking-wider text-accent">
          {eyebrow}
        </span>
      )}
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-primary sm:text-4xl">
        {title}
      </h2>
      {subtitle && <p className="mt-4 text-lg text-slate-600">{subtitle}</p>}
    </div>
  );
}

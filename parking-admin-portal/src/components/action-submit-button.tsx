"use client";

import { useFormStatus } from "react-dom";

export default function ActionSubmitButton({
  children,
  pendingText,
  style,
}: {
  children: React.ReactNode;
  pendingText: string;
  style?: React.CSSProperties;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} style={style}>
      {pending ? pendingText : children}
    </button>
  );
}

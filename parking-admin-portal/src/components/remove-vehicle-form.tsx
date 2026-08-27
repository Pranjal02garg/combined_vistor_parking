"use client";

import { useActionState, useEffect, useState } from "react";
import ActionSubmitButton from "@/components/action-submit-button";

const initialState = {
  error: "",
  success: false,
};

export default function RemoveVehicleForm({
  action,
  inputStyle,
  buttonStyle,
  formGridStyle,
}: {
  action: (
    prevState: { error?: string; success?: boolean } | undefined,
    formData: FormData,
  ) => Promise<{ error?: string; success?: boolean }>;
  inputStyle: React.CSSProperties;
  buttonStyle: React.CSSProperties;
  formGridStyle: React.CSSProperties;
}) {
  const [state, formAction] = useActionState(action, initialState);

  const [identifier, setIdentifier] = useState("");
  const [plateNumber, setPlateNumber] = useState("");

  useEffect(() => {
    if (state?.success) {
      setIdentifier("");
      setPlateNumber("");
    }
  }, [state]);

  return (
    <form action={formAction} style={formGridStyle}>
      <input
        name="identifier"
        placeholder="User email or name"
        required
        style={inputStyle}
        value={identifier}
        onChange={(e) => setIdentifier(e.target.value)}
      />

      <input
        name="plateNumber"
        placeholder="Vehicle number to remove"
        required
        style={inputStyle}
        value={plateNumber}
        onChange={(e) => setPlateNumber(e.target.value)}
      />

      {state?.error ? (
        <p
          style={{
            gridColumn: "1 / -1",
            color: "#b91c1c",
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          {state.error}
        </p>
      ) : null}

      {state?.success ? (
        <p
          style={{
            gridColumn: "1 / -1",
            color: "#0f6b4f",
            margin: 0,
            fontSize: "14px",
            fontWeight: 600,
          }}
        >
          Vehicle removed successfully.
        </p>
      ) : null}

      <ActionSubmitButton
        pendingText="Removing Vehicle..."
        style={{
          ...buttonStyle,
          gridColumn: "1 / -1",
          background: "#b91c1c",
        }}
      >
        Remove Vehicle
      </ActionSubmitButton>
    </form>
  );
}

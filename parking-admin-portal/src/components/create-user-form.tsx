"use client";

import { useActionState, useEffect, useState } from "react";
import ActionSubmitButton from "@/components/action-submit-button";

const initialState = {
  error: "",
  success: false,
};

export default function CreateUserForm({
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

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plateNumber, setPlateNumber] = useState("");
  const [stickerColor, setStickerColor] = useState("green");
  const [parkingEligible, setParkingEligible] = useState(false);
  const [eligibleFrom, setEligibleFrom] = useState("");
  const [eligibleTill, setEligibleTill] = useState("");

  useEffect(() => {
    if (state?.success) {
      setName("");
      setEmail("");
      setPassword("");
      setPlateNumber("");
      setStickerColor("green");
      setParkingEligible(false);
      setEligibleFrom("");
      setEligibleTill("");
    }
  }, [state]);

  return (
    <form action={formAction} style={formGridStyle}>
      <input
        name="name"
        placeholder="Name"
        required
        style={inputStyle}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        style={inputStyle}
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        name="password"
        type="password"
        placeholder="Temporary Password"
        required
        style={inputStyle}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <input
        name="plateNumber"
        placeholder="Vehicle number"
        style={inputStyle}
        value={plateNumber}
        onChange={(e) => setPlateNumber(e.target.value)}
      />

      <select
        name="stickerColor"
        style={inputStyle}
        value={stickerColor}
        onChange={(e) => setStickerColor(e.target.value)}
      >
        <option value="green">Green</option>
        <option value="red">Red</option>
        <option value="blue">Blue</option>
      </select>

      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          fontSize: "15px",
          color: "#334155",
          minHeight: "48px",
        }}
      >
        <input
          type="checkbox"
          name="parkingEligible"
          checked={parkingEligible}
          onChange={(e) => setParkingEligible(e.target.checked)}
        />
        Allow parking access
      </label>

      <input
        name="eligibleFrom"
        type="date"
        style={inputStyle}
        value={eligibleFrom}
        onChange={(e) => setEligibleFrom(e.target.value)}
      />

      <input
        name="eligibleTill"
        type="date"
        style={inputStyle}
        value={eligibleTill}
        onChange={(e) => setEligibleTill(e.target.value)}
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
          User created successfully.
        </p>
      ) : null}

      <ActionSubmitButton
        pendingText="Creating User..."
        style={{
          ...buttonStyle,
          gridColumn: "1 / -1",
        }}
      >
        Create User
      </ActionSubmitButton>
    </form>
  );
}

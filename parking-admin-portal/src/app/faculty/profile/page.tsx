"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { mobileClient, MobileUser } from "@/lib/mobile-client";

export default function FacultyProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState<MobileUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Profile Edit State
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("");
  const [phone, setPhone] = useState("");
  const [alternateContact, setAlternateContact] = useState("");
  const [profileMsg, setProfileMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingProfile, setSavingProfile] = useState(false);

  // Password Change State
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMsg, setPasswordMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [savingPassword, setSavingPassword] = useState(false);

  useEffect(() => {
    mobileClient.getMe().then((res) => {
      if (res.data?.user) {
        setUser(res.data.user);
        setName(res.data.user.name || "");
        setDepartment(res.data.user.department || "");
        setPhone(res.data.user.phone || "");
        setAlternateContact(res.data.user.alternateContact || "");
      }
    }).finally(() => setLoading(false));
  }, []);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await mobileClient.updateProfile({
        name,
        department,
        phone,
        alternateContact,
      });

      if (res.error) {
        setProfileMsg({ type: "error", text: res.error });
      } else if (res.data?.user) {
        setUser(res.data.user);
        setEditing(false);
        setProfileMsg({ type: "success", text: "✅ Profile details updated successfully." });
      }
    } catch (err: any) {
      setProfileMsg({ type: "error", text: err?.message || "Failed to update profile." });
    } finally {
      setSavingProfile(false);
      setTimeout(() => setProfileMsg(null), 5000);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMsg(null);

    if (newPassword.length < 8) {
      setPasswordMsg({ type: "error", text: "New password must be at least 8 characters." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMsg({ type: "error", text: "New passwords do not match." });
      return;
    }

    setSavingPassword(true);
    try {
      const res = await mobileClient.changePassword(currentPassword, newPassword);
      if (res.error) {
        setPasswordMsg({ type: "error", text: res.error });
      } else {
        setPasswordMsg({ type: "success", text: "✅ Password changed successfully." });
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
        setShowPasswordForm(false);
      }
    } catch (err: any) {
      setPasswordMsg({ type: "error", text: err?.message || "Failed to change password." });
    } finally {
      setSavingPassword(false);
      setTimeout(() => setPasswordMsg(null), 5000);
    }
  };

  const handleLogout = async () => {
    if (confirm("Are you sure you want to sign out of this device?")) {
      await mobileClient.logout();
      router.push("/faculty/login");
    }
  };

  return (
    <div className="space-y-5">
      {/* Profile Header */}
      <div className="text-center bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md relative overflow-hidden">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white flex items-center justify-center text-3xl mx-auto shadow-xl shadow-blue-500/20 mb-3">
          🎓
        </div>
        <h2 className="text-lg font-black text-white">{user?.name || "Faculty Member"}</h2>
        <p className="text-xs text-slate-400 font-mono mt-0.5">{user?.email}</p>
        <div className="mt-3 flex items-center justify-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 text-[10px] font-bold">
            {user?.department || "Academic Faculty"}
          </span>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
            {user?.allowed ? "Active Permit" : "No Permit"}
          </span>
        </div>
      </div>

      {profileMsg && (
        <div
          className={`p-3 rounded-xl border text-xs font-semibold ${
            profileMsg.type === "success"
              ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
              : "bg-rose-500/15 border-rose-500/30 text-rose-300"
          }`}
        >
          {profileMsg.text}
        </div>
      )}

      {/* Profile Information / Edit Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Personal Information
          </h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300"
            >
              ✏️ Edit
            </button>
          )}
        </div>

        {editing ? (
          <form onSubmit={handleUpdateProfile} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Department
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science & Engineering"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 98765 43210"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1">
                Alternate Emergency Contact
              </label>
              <input
                type="tel"
                value={alternateContact}
                onChange={(e) => setAlternateContact(e.target.value)}
                placeholder="+91 98765 00000"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingProfile}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
              >
                {savingProfile ? "Saving..." : "Save Changes"}
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-3 text-xs">
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500">Official Email</span>
              <span className="font-medium text-slate-200">{user?.email}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500">Department</span>
              <span className="font-medium text-slate-200">{user?.department || "Not specified"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500">Primary Phone</span>
              <span className="font-medium text-slate-200">{user?.phone || "Not added"}</span>
            </div>
            <div className="flex justify-between py-1.5 border-b border-slate-800/80">
              <span className="text-slate-500">Alternate Contact</span>
              <span className="font-medium text-slate-200">{user?.alternateContact || "Not added"}</span>
            </div>
            <div className="flex justify-between py-1.5">
              <span className="text-slate-500">Account Role</span>
              <span className="font-semibold text-blue-400 uppercase">{user?.role || "Faculty"}</span>
            </div>
          </div>
        )}
      </div>

      {/* Security & Password Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Security & Login
          </h3>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-xs font-bold text-blue-400 hover:text-blue-300"
            >
              Change Password
            </button>
          )}
        </div>

        {passwordMsg && (
          <div
            className={`p-2.5 rounded-xl border text-xs font-semibold mb-3 ${
              passwordMsg.type === "success"
                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-300"
                : "bg-rose-500/15 border-rose-500/30 text-rose-300"
            }`}
          >
            {passwordMsg.text}
          </div>
        )}

        {showPasswordForm ? (
          <form onSubmit={handleChangePassword} className="space-y-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                New Password (min 8 chars)
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-400 mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                disabled={savingPassword}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl shadow-md disabled:opacity-50"
              >
                {savingPassword ? "Updating..." : "Update Password"}
              </button>
              <button
                type="button"
                onClick={() => setShowPasswordForm(false)}
                className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-bold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <p className="text-xs text-slate-500">
            Passwords are protected with military-grade Argon2id hashing and account lockout mechanisms.
          </p>
        )}
      </div>

      {/* Sign Out Button */}
      <button
        onClick={handleLogout}
        className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 active:bg-rose-500/30 text-rose-400 border border-rose-500/20 text-xs font-bold rounded-2xl transition-all flex items-center justify-center gap-2 shadow-sm"
      >
        <span>🚪</span>
        <span>Sign Out of Faculty Mobile App</span>
      </button>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import styles from "../dashboard.module.css";
import { useRouter } from "next/navigation";

type DashboardUser = {
  _id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  isActive: boolean;
  parkingEligible: boolean;
  eligibleFrom: string | null;
  eligibleTill: string | null;
  allowedCars: { plateNumber: string; stickerColor: string; isActive?: boolean }[];
  createdAt?: string | null;
  updatedAt?: string | null;
};

export default function UsersView({
  users,
  authEmail,
  actions
}: {
  users: DashboardUser[];
  authEmail: string;
  actions: {
    toggleUserStatus: (formData: FormData) => Promise<void>;
    toggleParkingAccess: (formData: FormData) => Promise<void>;
    removeSingleVehicle: (formData: FormData) => Promise<void>;
    addSingleVehicle: (formData: FormData) => Promise<void>;
    updateUserDetails: (prevState: any, formData: FormData) => Promise<{error?: string; success?: boolean}>;
    createManagedUser: (prevState: any, formData: FormData) => Promise<{error?: string; success?: boolean}>;
    toggleVehicleStatus: (formData: FormData) => Promise<void>;
  }
}) {
  const [search, setSearch] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  
  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editUser, setEditUser] = useState<DashboardUser | null>(null);
  
  // Forms state
  const [formError, setFormError] = useState("");
  const [newVehicleInputs, setNewVehicleInputs] = useState<Record<string, string>>({});

  const filteredUsers = users.filter((user) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const cars = user.allowedCars?.map(c => c.plateNumber).join(" ").toLowerCase() || "";
    return user.name.toLowerCase().includes(q) || 
           user.email.toLowerCase().includes(q) || 
           user.role.toLowerCase().includes(q) || 
           cars.includes(q);
  });

  const runAction = (actionFn: () => Promise<void>) => {
    startTransition(async () => {
      await actionFn();
      router.refresh();
    });
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await actions.createManagedUser(undefined, formData);
      if (res?.error) {
        setFormError(res.error);
      } else {
        setShowCreateModal(false);
        router.refresh();
      }
    });
  };

  const handleEditUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError("");
    const formData = new FormData(e.currentTarget);
    formData.append("email", editUser!.email); // email is readonly identifier
    
    startTransition(async () => {
      const res = await actions.updateUserDetails(undefined, formData);
      if (res?.error) {
        setFormError(res.error);
      } else {
        setEditUser(null);
        router.refresh();
      }
    });
  };

  const handleAddVehicle = (email: string) => {
    const plate = newVehicleInputs[email];
    if (!plate) return;
    
    const formData = new FormData();
    formData.append("email", email);
    formData.append("plateNumber", plate);
    formData.append("stickerColor", "green"); // Defaulting to green for simplicity in inline add
    
    runAction(async () => {
      await actions.addSingleVehicle(formData);
      setNewVehicleInputs(prev => ({ ...prev, [email]: "" }));
    });
  };

  return (
    <div>
      <div className={styles.cardHeader} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h1 className={styles.cardTitle}>User Management</h1>
          <p className={styles.cardSubtitle}>Manage admins, users, and their vehicles</p>
        </div>
        <button className={styles.buttonPrimary} onClick={() => setShowCreateModal(true)}>
          + Create User
        </button>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="Search by name, email, role, vehicle..."
          className={styles.input}
          style={{ maxWidth: "400px" }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className={styles.tableContainer} style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 0.2s" }}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>User</th>
              <th>Role</th>
              <th>Vehicles</th>
              <th>Expiry</th>
              <th>Status / Access</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  No users found.
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user._id}>
                  <td>
                    <div style={{ fontWeight: 600, color: "#0f172a" }}>{user.name}</div>
                    <div style={{ fontSize: "13px", color: "#64748b" }}>{user.email}</div>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${user.role === 'admin' ? styles.badgeAdmin : ''}`}>
                      {user.role.toUpperCase()}
                    </span>
                  </td>
                  <td>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                      {user.allowedCars?.map((car, idx) => (
                        <div key={idx} className={styles.badge} style={{ background: car.isActive === false ? "#fee2e2" : "#e2e8f0", color: car.isActive === false ? "#991b1b" : "inherit" }}>
                          <span style={{ textDecoration: car.isActive === false ? "line-through" : "none" }}>{car.plateNumber}</span>
                          <button
                            type="button"
                            title={car.isActive === false ? "Activate" : "Deactivate"}
                            onClick={() => {
                              const fd = new FormData();
                              fd.append("email", user.email);
                              fd.append("plateNumber", car.plateNumber);
                              fd.append("nextStatus", (car.isActive === false ? "true" : "false"));
                              runAction(() => actions.toggleVehicleStatus(fd));
                            }}
                            style={{ background: "none", border: "none", marginLeft: "6px", cursor: "pointer", color: car.isActive === false ? "#059669" : "#d97706", fontWeight: "bold" }}
                          >
                            {car.isActive === false ? "▶" : "⏸"}
                          </button>
                          <button
                            type="button"
                            title="Delete Permanently"
                            onClick={() => {
                              if (confirm("Delete this vehicle permanently?")) {
                                const fd = new FormData();
                                fd.append("email", user.email);
                                fd.append("plateNumber", car.plateNumber);
                                runAction(() => actions.removeSingleVehicle(fd));
                              }
                            }}
                            style={{ background: "none", border: "none", marginLeft: "6px", cursor: "pointer", color: "#ef4444", fontWeight: "bold" }}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <input 
                          type="text" 
                          placeholder="Add Plate..." 
                          className={styles.input} 
                          style={{ padding: "4px 8px", fontSize: "12px", width: "100px", borderRadius: "6px" }}
                          value={newVehicleInputs[user.email] || ""}
                          onChange={(e) => setNewVehicleInputs(prev => ({...prev, [user.email]: e.target.value}))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleAddVehicle(user.email);
                          }}
                        />
                        <button 
                          className={styles.buttonPrimary} 
                          style={{ padding: "4px 8px", fontSize: "12px", borderRadius: "6px" }}
                          onClick={() => handleAddVehicle(user.email)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </td>
                  <td>
                    {user.eligibleTill ? new Date(user.eligibleTill).toLocaleDateString() : "Infinite"}
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "8px", flexDirection: "column" }}>
                      {user.email !== authEmail && (
                        <button
                          className={styles.buttonSecondary}
                          style={{ padding: "6px 12px", fontSize: "12px", width: "100%", textAlign: "center", background: user.isActive ? "#fff" : "#fee2e2", borderColor: user.isActive ? "#e2e8f0" : "#fca5a5" }}
                          onClick={() => {
                            const fd = new FormData();
                            fd.append("email", user.email);
                            fd.append("nextStatus", (!user.isActive).toString());
                            runAction(() => actions.toggleUserStatus(fd));
                          }}
                        >
                          {user.isActive ? "Active (Deactivate)" : "Inactive (Activate)"}
                        </button>
                      )}
                      
                      <button
                        className={styles.buttonSecondary}
                        style={{ padding: "6px 12px", fontSize: "12px", width: "100%", textAlign: "center", background: user.parkingEligible ? "#dcfce7" : "#fff", borderColor: user.parkingEligible ? "#86efac" : "#e2e8f0" }}
                        onClick={() => {
                          const fd = new FormData();
                          fd.append("email", user.email);
                          fd.append("nextAccess", (!user.parkingEligible).toString());
                          runAction(() => actions.toggleParkingAccess(fd));
                        }}
                      >
                        {user.parkingEligible ? "Parking: Allowed" : "Parking: Denied"}
                      </button>
                    </div>
                  </td>
                  <td>
                    <button 
                      className={styles.buttonSecondary} 
                      onClick={() => setEditUser(user)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* CREATE USER MODAL */}
      {showCreateModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Create New User</h2>
              <button className={styles.closeButton} onClick={() => setShowCreateModal(false)}>×</button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name</label>
                <input name="name" className={styles.input} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email Address</label>
                <input name="email" type="email" className={styles.input} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Temporary Password</label>
                <input name="password" type="password" className={styles.input} required />
              </div>
              <div className={styles.formGroup}>
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "15px", fontWeight: 600 }}>
                  <input type="checkbox" name="parkingEligible" />
                  Grant Parking Access Immediately
                </label>
              </div>
              
              {formError && <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>{formError}</p>}
              
              <button type="submit" className={styles.buttonPrimary} style={{ width: "100%" }} disabled={isPending}>
                {isPending ? "Creating..." : "Create User"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* EDIT USER MODAL */}
      {editUser && (
        <div className={styles.modalOverlay}>
          <div className={styles.modal}>
            <div className={styles.modalHeader}>
              <h2 className={styles.modalTitle}>Edit User Profile</h2>
              <button className={styles.closeButton} onClick={() => setEditUser(null)}>×</button>
            </div>
            <form onSubmit={handleEditUser}>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Email (Cannot be changed)</label>
                <input className={styles.input} value={editUser.email} disabled style={{ background: "#f8fafc", color: "#94a3b8" }} />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Full Name</label>
                <input name="name" className={styles.input} defaultValue={editUser.name} required />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Role</label>
                <select name="role" className={styles.input} defaultValue={editUser.role}>
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Change Password (Optional)</label>
                <input name="password" type="password" className={styles.input} placeholder="Leave blank to keep current password" />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.formLabel}>Expiry Date (Leave blank for Infinite)</label>
                <input name="eligibleTill" type="date" className={styles.input} defaultValue={editUser.eligibleTill ? editUser.eligibleTill.split('T')[0] : ""} />
              </div>
              
              {formError && <p style={{ color: "#ef4444", fontSize: "14px", marginBottom: "16px" }}>{formError}</p>}
              
              <button type="submit" className={styles.buttonPrimary} style={{ width: "100%" }} disabled={isPending}>
                {isPending ? "Saving..." : "Save Changes"}
              </button>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}

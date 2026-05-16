import React, { useState, useEffect } from "react";

// Plate number regex: PH format e.g. ABC 1234 or ABC-1234 or ABC1234
const PLATE_REGEX = /^[A-Z]{2,3}[\s-]?\d{3,4}$/i;
// PH mobile: exactly 11 digits, must start with 09
const PHONE_REGEX = /^09\d{9}$/;
// Name: letters, spaces, hyphens, apostrophes only
const NAME_REGEX = /^[A-Za-z\s'-]+$/;

const initialForm = { name: "", plate: "", phone: "" };

const RiderModal = ({ open, orderNumber, onConfirm, onCancel }) => {
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setForm(initialForm); setTouched({}); setSubmitting(false); }
  }, [open]);

  if (!open) return null;

  const validate = (f) => ({
    name:
      !f.name.trim()
        ? "Rider name is required."
        : !NAME_REGEX.test(f.name.trim())
        ? "Name must contain letters only."
        : f.name.trim().length < 2
        ? "Name must be at least 2 characters."
        : f.name.trim().length > 54
        ? "Name must be 54 characters or fewer."
        : null,
    plate:
      !f.plate.trim()
        ? "Plate number is required."
        : !PLATE_REGEX.test(f.plate.trim())
        ? "Enter a valid PH plate number (e.g. ABC 1234)."
        : null,
    phone:
      !f.phone.trim()
        ? "Phone number is required."
        : !/^\d+$/.test(f.phone.trim())
        ? "Phone number must contain digits only."
        : f.phone.trim().length !== 11
        ? "Phone number must be exactly 11 digits."
        : !f.phone.trim().startsWith("09")
        ? "Phone number must start with 09."
        : null,
  });

  const errors = validate(form);
  const isValid = !Object.values(errors).some(Boolean);

  const handleChange = (field) => (e) => {
    setForm((p) => ({ ...p, [field]: e.target.value }));
  };

  const handleBlur = (field) => () => {
    setTouched((p) => ({ ...p, [field]: true }));
  };

  const handleSubmit = async () => {
    setTouched({ name: true, plate: true, phone: true });
    if (!isValid) return;
    setSubmitting(true);
    await onConfirm({
      name:  form.name.trim(),
      plate: form.plate.trim().toUpperCase(),
      phone: form.phone.trim(),
    });
    setSubmitting(false);
  };

  const fields = [
    {
      key: "name",
      label: "Rider Name",
      placeholder: "e.g. Juan Dela Cruz",
      type: "text",
      maxLength: 54,
    },
    {
      key: "plate",
      label: "Plate Number",
      placeholder: "e.g. ABC 1234",
      type: "text",
      maxLength: 10,
    },
    {
      key: "phone",
      label: "Phone Number",
      placeholder: "e.g. 09171234567",
      type: "tel",
      maxLength: 11,
    },
  ];

  return (
    <div style={styles.backdrop} onClick={onCancel}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.headerIcon}>🏍️</div>
          <div>
            <div style={styles.headerTitle}>Assign Rider</div>
            <div style={styles.headerSub}>Order #{orderNumber}</div>
          </div>
        </div>

        <p style={styles.description}>
          Enter the rider's details before marking this order as{" "}
          <strong>Shipping</strong>. These will be visible to the customer.
        </p>

        {/* Fields */}
        <div style={styles.fields}>
          {fields.map(({ key, label, placeholder, type, maxLength }) => {
            const hasError = touched[key] && errors[key];
            return (
              <div key={key} style={styles.fieldGroup}>
                <label style={styles.label}>{label}</label>
                <input
                  type={type}
                  value={form[key]}
                  onChange={handleChange(key)}
                  onBlur={handleBlur(key)}
                  placeholder={placeholder}
                  maxLength={maxLength}
                  style={{
                    ...styles.input,
                    ...(hasError ? styles.inputError : {}),
                  }}
                  disabled={submitting}
                />
                {hasError && (
                  <div style={styles.errorMsg}>⚠ {errors[key]}</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Actions */}
        <div style={styles.actions}>
          <button style={styles.cancelBtn} onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button
            style={{ ...styles.confirmBtn, ...((!isValid || submitting) ? styles.confirmBtnDisabled : {}) }}
            onClick={handleSubmit}
            disabled={!isValid || submitting}
          >
            {submitting ? "Saving…" : "Confirm & Mark Shipping"}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.45)",
    backdropFilter: "blur(3px)",
    zIndex: 9999,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "16px",
  },
  modal: {
    background: "#fff",
    borderRadius: "16px",
    padding: "28px",
    width: "100%",
    maxWidth: "420px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.18)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    marginBottom: "16px",
  },
  headerIcon: {
    fontSize: "32px",
    background: "#f0f9ff",
    borderRadius: "12px",
    width: "52px",
    height: "52px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "18px",
    fontWeight: "700",
    color: "#111",
  },
  headerSub: {
    fontSize: "13px",
    color: "#6b7280",
    marginTop: "2px",
  },
  description: {
    fontSize: "13px",
    color: "#6b7280",
    lineHeight: "1.6",
    margin: "0 0 20px",
    background: "#f8fafc",
    border: "1px solid #e2e8f0",
    borderRadius: "8px",
    padding: "10px 14px",
  },
  fields: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginBottom: "24px",
  },
  fieldGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  label: {
    fontSize: "12px",
    fontWeight: "600",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  input: {
    border: "1.5px solid #d1d5db",
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "14px",
    color: "#111",
    outline: "none",
    transition: "border-color 0.15s",
    background: "#fff",
  },
  inputError: {
    borderColor: "#ef4444",
    background: "#fff5f5",
  },
  errorMsg: {
    fontSize: "12px",
    color: "#ef4444",
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  actions: {
    display: "flex",
    gap: "10px",
    justifyContent: "flex-end",
  },
  cancelBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "1.5px solid #e5e7eb",
    background: "#fff",
    color: "#374151",
    fontWeight: "600",
    fontSize: "14px",
    cursor: "pointer",
  },
  confirmBtn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    background: "#0ea5e9",
    color: "#fff",
    fontWeight: "700",
    fontSize: "14px",
    cursor: "pointer",
    transition: "background 0.15s",
  },
  confirmBtnDisabled: {
    background: "#93c5fd",
    cursor: "not-allowed",
  },
};

export default RiderModal;

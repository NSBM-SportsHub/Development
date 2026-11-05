import { useEffect, useState } from "react";
import { api } from "../../shared/api.js";
import { Button, Icon, Loading, Notice } from "../../shared/ui.jsx";
import "./bookings.css";

const dateTimeFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

const statusLabels = {
  pending: "Pending",
  approved: "Approved",
  rejected: "Rejected",
  cancelled: "Cancelled",
};

function parseDateTime(value) {
  if (typeof value !== "string") return null;
  const utcValue = /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(utcValue);
  return Number.isNaN(date.valueOf()) ? null : date;
}

function BookingDateTime({ value }) {
  const date = parseDateTime(value);
  if (!date) return "—";
  return <time dateTime={date.toISOString()}>{dateTimeFormatter.format(date)}</time>;
}

function statusLabel(status) {
  return statusLabels[status] || status;
}

export default function BookingsPage() {
  const [bookings, setBookings] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [loadingError, setLoadingError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [processingId, setProcessingId] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoadingError("");
    api.get("/bookings", { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setBookings(data);
      })
      .catch((failure) => {
        if (!controller.signal.aborted) setLoadingError(failure.message);
      });
    return () => controller.abort();
  }, [reloadKey]);

  async function reviewBooking(booking, status) {
    if (processingId !== null || booking.status !== "pending") return;
    setProcessingId(booking.id);
    setLoadingError("");
    setActionError("");
    setNotice("");
    try {
      const updatedBooking = await api.patch(`/bookings/${booking.id}`, { status });
      setBookings((current) => current?.map((item) => item.id === updatedBooking.id ? updatedBooking : item) ?? [updatedBooking]);
      setNotice(`Booking #${booking.id} ${status === "approved" ? "approved" : "rejected"}.`);
      setReloadKey((key) => key + 1);
    } catch (failure) {
      setActionError(failure.status === 409
        ? `Booking #${booking.id} could not be approved because its resource or time slot conflicts with current reservations. The booking list will be refreshed.`
        : failure.message);
      if (failure.status === 409) setReloadKey((key) => key + 1);
    } finally {
      setProcessingId(null);
    }
  }

  const pendingCount = bookings?.filter((booking) => booking.status === "pending").length ?? 0;
  const visibleBookings = (bookings ?? []).filter((booking) => statusFilter === "all" || booking.status === statusFilter);

  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">ADMINISTRATION</span>
          <h1>Booking management</h1>
          <p>Review facility and equipment booking requests.</p>
        </div>
      </div>
      <Notice type="success">{notice}</Notice>
      <Notice>{actionError}</Notice>
      <section className="directory-summary" aria-label="Booking overview">
        <div className="summary-icon"><Icon name="check" size={24} /></div>
        <div>
          <strong>Booking requests</strong>
          <p>Review pending requests. Booking conflicts are checked by the server.</p>
        </div>
        <span className="badge badge-role">{pendingCount} pending</span>
      </section>
      <section className="card directory-card">
        <div className="directory-toolbar">
          <div>
            <h2 className="booking-list-heading">All bookings</h2>
            <p className="booking-time-hint">Times are shown in your local time zone.</p>
          </div>
          <div className="booking-filters">
            <label htmlFor="booking-status-filter">Filter by status</label>
            <select
              id="booking-status-filter"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              disabled={processingId !== null}
            >
              <option value="all">All statuses</option>
              {Object.entries(statusLabels).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        </div>
        {loadingError && (
          <div className="directory-state">
            <Notice>{loadingError}</Notice>
            <Button className="button-secondary" onClick={() => setReloadKey((key) => key + 1)}>
              Try again
            </Button>
          </div>
        )}
        {bookings === null ? (
          loadingError ? null : <Loading message="Loading bookings…" />
        ) : visibleBookings.length === 0 ? (
          <div className="empty-state">
            <span className="section-icon"><Icon name="check" size={26} /></span>
            <h2>{statusFilter === "all" ? "No bookings to display" : `No ${statusLabel(statusFilter).toLowerCase()} bookings`}</h2>
            <p>{statusFilter === "pending" ? "New booking requests will appear here." : "Try another status filter to see more bookings."}</p>
          </div>
        ) : (
          <div className="table-scroll">
            <table className="users-table bookings-table">
              <caption className="sr-only">Facility and equipment bookings</caption>
              <thead>
                <tr>
                  <th scope="col">Booking</th>
                  <th scope="col">Requested by</th>
                  <th scope="col">Resource</th>
                  <th scope="col">Starts</th>
                  <th scope="col">Ends</th>
                  <th scope="col">Quantity</th>
                  <th scope="col">Status</th>
                  <th scope="col">Notes</th>
                  <th scope="col" className="actions-heading">Review</th>
                </tr>
              </thead>
              <tbody>
                {visibleBookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>#{booking.id}</td>
                    <td>{booking.requested_by}</td>
                    <td>
                      <strong>{booking.resource_name || "—"}</strong>
                      <span className="booking-resource-type">{booking.resource_type || "—"}</span>
                    </td>
                    <td><BookingDateTime value={booking.starts_at} /></td>
                    <td><BookingDateTime value={booking.ends_at} /></td>
                    <td>{booking.resource_type === "equipment" ? booking.quantity : "—"}</td>
                    <td><span className={`badge booking-status booking-status-${booking.status}`}>{statusLabel(booking.status)}</span></td>
                    <td className="booking-notes">{booking.notes || "—"}</td>
                    <td>
                      {booking.status === "pending" ? (
                        <div className="booking-actions">
                          <Button
                            className="button-small"
                            busy={processingId === booking.id}
                            disabled={processingId !== null}
                            aria-label={`Approve booking ${booking.id}`}
                            onClick={() => reviewBooking(booking, "approved")}
                          >
                            <Icon name="check" size={15} />Approve
                          </Button>
                          <Button
                            className="button-danger button-small"
                            disabled={processingId !== null}
                            aria-label={`Reject booking ${booking.id}`}
                            onClick={() => reviewBooking(booking, "rejected")}
                          >
                            Reject
                          </Button>
                        </div>
                      ) : <span className="booking-no-action">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}

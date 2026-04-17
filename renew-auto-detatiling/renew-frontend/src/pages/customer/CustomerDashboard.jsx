import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react"
import toast from "react-hot-toast";
import { confirmAction } from "../../components/ConfirmModal";
import CustomerLayout from "../../components/CustomerLayout";
import CustomerSidebar from "../../components/CustomerSideBar";
import "../../App.css";

const CustomerDashboard = () => {

  const canCancel = (status) => {
    return status === "PENDING" || status === "SCHEDULED";
  };

  const navigate = useNavigate();
  const token = localStorage.getItem("token");

  const [booking,setBooking] = useState({
    id:null,
    status:"",
    paymentStatus:"",
    appointmentStart:null,
    services:[],
    notes:"",
    totalAmount:0,
    amountPaid:0,
    customer:null,
    payments:[],
    vehicleType:"",
    plateNumber:"",
    contactNumber:"",
    email:"",
    paymentMethod:"CASH"
  });

  const [history,setHistory] = useState([]);
  const [loading,setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  
  useEffect(()=>{
    if (!token) return;

const loadBooking = async () => {

  try{

    const res = await fetch(
      "http://localhost:5000/api/bookings",
      {
        headers:{
          Authorization:`Bearer ${token}`
        },
        method:"GET"
      }
    );

    let data;

try {
  data = await res.json();
} catch {
  throw new Error("Server error");
}

    const bookings = Array.isArray(data) ? data : data.bookings || [];

    if(bookings.length === 0){
      setBooking({
        id: null,
        status: "",
        paymentStatus: "",
        appointmentStart: null,
        services: [],
        notes: "",
        totalAmount: 0,
        amountPaid: 0,
        customer: null,
        payments: [],
        vehicleType: "",
        plateNumber: "",
        contactNumber: "",
        email: "",
        paymentMethod: "CASH"
      });
      setHistory([]);
      setLoading(false);
      return;
    }

    const filtered = bookings.filter(
      b => b.status !== "CANCELLED"
    );

    const activeBooking =
      filtered.find(b => b.status !== "COMPLETED")
      || filtered[0];

    if (activeBooking) {
      const services = activeBooking.items?.map(item => ({
        name: item.service?.name || item.serviceNameAtBooking || "Service",
        price: Number(item.priceAtBooking || item.price || 0)
      })) || [];

      setBooking({
        id: activeBooking.id,
        status: activeBooking.status,
        paymentStatus: activeBooking.paymentStatus,
        appointmentStart: activeBooking.appointmentStart,
        services: services,
        notes: activeBooking.notes || "",
        totalAmount: Number(activeBooking.totalAmount || 0),
        amountPaid: Number(activeBooking.amountPaid || 0),
        customer: activeBooking.customer,
        payments: activeBooking.payments || [],
        vehicleType: activeBooking.vehicleType || "",
        plateNumber: activeBooking.plateNumber || "",
        contactNumber: activeBooking.contactNumber || "",
        email: activeBooking.email || "",
        paymentMethod: activeBooking.paymentMethod || "CASH"
      });
    } else {
      // No active booking
      setBooking({
        id: null,
        status: "",
        paymentStatus: "",
        appointmentStart: null,
        services: [],
        notes: "",
        totalAmount: 0,
        amountPaid: 0,
        customer: null,
        payments: [],
        vehicleType: "",
        plateNumber: "",
        contactNumber: "",
        email: "",
        paymentMethod: "CASH"
      });
    }

    const completedBookings = bookings
      .filter(b => b.status === "COMPLETED")
      .slice(0,2);

    setHistory(completedBookings);

  } catch {
    // handled globally by axios
  } finally {
    setLoading(false);
  }

};

    loadBooking();

    // Refresh data every 10 seconds to catch payment updates
    const interval = setInterval(loadBooking, 10000);
    return () => clearInterval(interval);

  },[token]);

  useEffect(()=>{

  if (!token) return;

  const loadNotifications = async () => {

    try{

      const res = await fetch(
        "http://localhost:5000/api/notifications",
        {
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );

      const data = await res.json();
      setNotifications(data.notifications || []);

    }catch(err){
      console.log("Notification fetch error:",err);
    }

  };

  loadNotifications();

},[token]);

  const total = booking.services.reduce((sum,s)=>sum + (s.price || 0),0);
  const balance = total - booking.amountPaid;


  const cancelBooking = async () => {

  if (!booking.id) return;

  const confirmed = await confirmAction({
    title: "Cancel Booking",
    message: "Are you sure you want to cancel this booking?",
    confirmText: "Yes, Cancel",
    cancelText: "Keep Booking",
    type: "danger"
  });

  if (!confirmed) return;

  try {

    const res = await fetch(
      `http://localhost:5000/api/bookings/request-cancel/${booking.id}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    // 🔥 HANDLE ERROR FIRST (NO JSON PARSE YET)
    if (!res.ok) {
// handled globally
      return;
    }

    // 🔥 ONLY PARSE IF SUCCESS
    await res.json();

    toast.success("Booking cancelled");

    // Immediately clear the booking from UI
    setBooking({
      id: null,
      status: "",
      paymentStatus: "",
      appointmentStart: null,
      services: [],
      notes: "",
      totalAmount: 0,
      amountPaid: 0,
      customer: null,
      payments: [],
      vehicleType: "",
      plateNumber: "",
      contactNumber: "",
      email: "",
      paymentMethod: "CASH"
    });

  } catch (err) {

    console.error("Cancel failed", err);
    toast.error("Cancel failed");

  }

};
  const isCancelled = booking.status === "CANCELLED";

return (

  <CustomerLayout active="dashboard">

    <div
      className="dashboard-main"
      style={{
        width: "100%",
      }}
    >

      <h1 style={{marginBottom:"20px"}}>WELCOME BACK!</h1>

      {loading && <p>Loading your booking...</p>}

      <div className="dashboard-grid">

        {/* MAIN CARD */}

        <div className="card">

          <h3>Your Booking Details</h3>

          {isCancelled || !booking.id ? (

            <div style={{marginTop:"20px"}}>
              <p style={{fontWeight:"600", marginBottom:"6px"}}>
                Currently no active booking.
              </p>
              <p style={{marginTop:"10px"}}>Book a service to get started.</p>
            </div>

          ) : (

            <>

              {/* STATUS SECTION */}

              <div style={{display:"flex",gap:"40px",marginTop:"28px"}}>

                <div style={{flex:1}}>
                  <p style={{fontSize:"12px",opacity:"0.7"}}>Booking Status</p>
                  <p style={{fontWeight:"600",marginTop:"4px"}}>
                    {booking.status}
                  </p>
                </div>

                <div style={{flex:1}}>
                  <p style={{fontSize:"12px",opacity:"0.7"}}>Payment Status</p>
                  <p style={{fontWeight:"600",marginTop:"4px"}}>
                    {booking.paymentStatus}
                  </p>
                </div>

              </div>

              <hr style={{margin:"20px 0"}} />

              <div style={{display:"flex",gap:"30px"}}>

                {/* LEFT SIDE */}

                <div style={{flex:2, display:"flex", flexDirection:"column"}}>

                  {/* APPOINTMENT */}

                  <div className="section-lg">
                    <p style={{fontWeight:"600", marginBottom:"6px"}}>Appointment Details</p>

                    {booking.appointmentStart && (
                      <p style={{marginTop:"6px"}}>
                        {new Date(booking.appointmentStart).toLocaleString()}
                      </p>
                    )}

                    <ul style={{marginTop:"18px",paddingLeft:"18px"}}>
                      {booking.services.map((service,i)=>(
                        <li key={i}>{service.name}</li>
                      ))}
                    </ul>
                  </div>

                  {/* CUSTOMER DETAILS */}

                  <div className="section-lg">
                    <p style={{fontWeight:"600", marginBottom:"6px"}}>Customer Details</p>

                    <div style={{
                      marginTop:"10px",
                      display:"grid",
                      gap:"6px"
                    }}>

                      <div>
                        <span style={{opacity:"0.6"}}>Name: </span>
                        <strong>{booking.customer?.fullName || "N/A"}</strong>
                      </div>

                      <div>
                        <span style={{opacity:"0.6"}}>Contact: </span>
                        <strong>{booking.contactNumber || "N/A"}</strong>
                      </div>

                      <div>
                        <span style={{opacity:"0.6"}}>Email: </span>
                        <strong>{booking.email || booking.customer?.email || "N/A"}</strong>
                      </div>

                      <div>
                        <span style={{opacity:"0.6"}}>Vehicle: </span>
                        <strong>{booking.vehicleType || "N/A"}</strong>
                      </div>

                      <div>
                        <span style={{opacity:"0.6"}}>Plate: </span>
                        <strong>{booking.plateNumber || "N/A"}</strong>
                      </div>

                      <div>
                        <span style={{opacity:"0.6"}}>Payment Method: </span>
                        <strong>{booking.paymentMethod === "GCASH" ? "GCash" : "Cash"}</strong>
                      </div>

                    </div>
                  </div>

                  {/* NOTES */}

                  <div className="section-lg">
                    <p style={{fontWeight:"600", marginBottom:"6px", color: "var(--text-primary)"}}>Notes</p>

                    <div style={{
                      marginTop:"10px",
                      padding:"14px",
                      borderRadius:"10px",
                      background:"var(--bg-primary)",
                      lineHeight:"1.5",
                      maxWidth:"95%" // ✅ prevents full stretch
                    }}>
                      {booking.notes || "No notes provided."}
                    </div>
                  </div>

                  {/* CANCEL BUTTON */}

<button
  onClick={cancelBooking}
  disabled={!canCancel(booking.status)}
  style={{
    padding: "10px 16px",
    borderRadius: "8px",
    border: "none",
    background: canCancel(booking.status) ? "var(--accent-red)" : "var(--bg-tertiary)",
    color: "#fff",
    cursor: canCancel(booking.status) ? "pointer" : "not-allowed",
    opacity: canCancel(booking.status) ? 1 : 0.6
  }}
>
  Cancel Booking
</button>

                </div>

                {/* RIGHT SIDE (TOTALS) */}

              <div style={{
                flex:1,
                borderLeft:"1px solid rgba(255,255,255,0.06)",
                paddingLeft:"20px",
                paddingTop:"10px" // ✅ aligns with left content
              }}>

                <p style={{fontWeight:"600", marginBottom:"6px"}}>Services & Amount</p>

                  {booking.services.map((service,i)=>(
                    <div key={i} style={{
                      display:"flex",
                      justifyContent:"space-between",
                      marginTop:"8px"
                    }}>
                      <span>{service.name}</span>
                      <span>₱{service.price.toLocaleString()}</span>
                    </div>
                  ))}

                  <hr style={{margin:"12px 0"}} />

                  <div style={{
                    display:"flex",
                    justifyContent:"space-between",
                    fontWeight:"bold",
                    fontSize:"16px",
                    color: "var(--text-primary)"
                  }}>
                    <span>Total</span>
                    <span>₱{booking.totalAmount.toLocaleString()}</span>
                  </div>

                  <div style={{
                    display:"flex",
                    justifyContent:"space-between",
                    marginTop:"6px",
                    color:"var(--accent-green)"
                  }}>
                    <span style={{fontSize:"13px"}}>Amount Paid</span>
                    <span style={{fontSize:"13px"}}>₱{booking.amountPaid.toLocaleString()}</span>
                  </div>

                  <div style={{
                    display:"flex",
                    justifyContent:"space-between",
                    marginTop:"4px",
                    color:"var(--accent-red)"
                  }}>
                    <span style={{fontSize:"13px"}}>Balance</span>
                    <span style={{fontSize:"13px"}}>₱{balance.toLocaleString()}</span>
                  </div>

                  {booking.payments && booking.payments.length > 0 && (
                    <>
                      <hr style={{margin:"16px 0 12px 0"}} />
                      <p style={{fontWeight:"600", marginBottom:"8px", fontSize:"13px"}}>Payment History</p>
                      {booking.payments.map((payment, i) => (
                        <div key={i} style={{
                          display:"flex",
                          justifyContent:"space-between",
                          marginTop:"6px",
                          fontSize:"12px",
                          opacity:0.8
                        }}>
                          <span>
                            {payment.method === "GCASH" ? "GCash" : "Cash"} - {new Date(payment.createdAt).toLocaleDateString()}
                          </span>
                          <span>₱{Number(payment.amount).toLocaleString()}</span>
                        </div>
                      ))}
                    </>
                  )}

                </div>

              </div>

            </>

          )}

        </div>

        {/* RIGHT PANEL */}

        <div className="right-stack">

          <div className="card">

            <h3>Booking History</h3>

            {history.length === 0 ? (
              <p>No completed bookings yet.</p>
            ) : (

              history.map((h,i)=>{

                const services =
                  h.items?.map(item => item.service?.name || item.serviceNameAtBooking).join(", ");
                const totalAmt = h.items?.reduce((sum, item) => sum + Number(item.priceAtBooking || 0), 0) || 0;

                return(
                  <div key={i} style={{marginTop:"14px"}}>
                    <strong>{services}</strong>
                    <p style={{fontSize:"12px",opacity:"0.6"}}>
                      {h.appointmentStart ? new Date(h.appointmentStart).toLocaleDateString() : ""} - ₱{totalAmt.toLocaleString()}
                    </p>
                  </div>
                );

              })

            )}

            <button
              style={{
                marginTop:"12px",
                padding:"8px 14px",
                borderRadius:"8px",
                border:"none",
                background:"var(--bg-tertiary)",
                color:"var(--text-primary)",
                cursor:"pointer"
              }}
              onClick={()=>navigate("/customer/bookings")}
            >
              Show All
            </button>

          </div>

          <div className="card">

            <h3>Notifications</h3>

          <div style={{marginTop:"10px"}}>

            {notifications.length === 0 ? (
              <p>No notifications yet.</p>
            ) : (
              notifications.slice(0,2).map(n => (
                <p key={n.id}>
                  ✔ {n.title}
                </p>
              ))
            )}

          </div>

            <button
              style={{
                marginTop:"12px",
                padding:"8px 14px",
                borderRadius:"8px",
                border:"none",
                background:"var(--bg-tertiary)",
                color:"var(--text-primary)",
                cursor:"pointer"
              }}
              onClick={()=>navigate("/customer/notifications")}
            >
              Show All
            </button>

          </div>

        </div>

      </div>

      {/* CTA */}

      <div className="cta-card" style={{marginTop:"40px"}}>

        <div>
          <h2 style={{ color: "var(--text-primary)" }}>READY FOR YOUR NEXT SERVICE?</h2>
          <p>
            Book an appointment now and keep your vehicle in pristine condition.
          </p>
        </div>

        <button onClick={()=>navigate("/customer/book")}>
          Book Now
        </button>

      </div>

    </div>

  </CustomerLayout>

);
}

export default CustomerDashboard;
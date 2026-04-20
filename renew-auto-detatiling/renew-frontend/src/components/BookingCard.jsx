import BookingStatusBadge from "./BookingStatusBadge";
import PaymentStatusBadge from "./PaymentStatusBadge";

const BookingCard = ({ booking, onCancel }) => {

  const start = new Date(booking.appointmentStart);

  const date = start.toLocaleDateString();
  const time = start.toLocaleTimeString([],{
    hour:"2-digit",
    minute:"2-digit"
  });

  const services =
    booking.items?.map(i=>i.service?.name).join(", ") || "No services";

  const total = booking.totalAmount || 0;

  const canCancel =
    booking.status === "PENDING" ||
    booking.status === "CONFIRMED";

  return(

    <div style={styles.card}>

      <div style={styles.row}>

        <strong>
          Booking #{booking.id}
        </strong>

        <BookingStatusBadge status={booking.status}/>

      </div>

      <p style={styles.services}>
        {services}
      </p>

      <p style={styles.info}>
        {date} • {time}
      </p>

      <div style={styles.row}>

        <PaymentStatusBadge
          status={booking.paymentStatus}
        />

        <strong>
          ₱{total.toLocaleString()}
        </strong>

      </div>

      {canCancel && onCancel && (

        <button
          style={styles.cancelBtn}
          onClick={()=>onCancel(booking.id)}
        >
          Cancel Booking
        </button>

      )}

    </div>

  );

};

const styles = {

card:{
border:"1px solid #334155",
borderRadius:"10px",
padding:"15px",
background:"#0f172a",
color:"#e2e8f0",
marginBottom:"10px"
},

row:{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"6px"
},

services:{
opacity:0.8,
fontSize:"14px"
},

info:{
opacity:0.7,
fontSize:"13px",
marginTop:"4px"
},

cancelBtn:{
marginTop:"10px",
background:"#ef4444",
border:"none",
color:"white",
padding:"6px 10px",
borderRadius:"6px",
cursor:"pointer"
}

};

export default BookingCard;

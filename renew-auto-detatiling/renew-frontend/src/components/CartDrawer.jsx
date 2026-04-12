const CartDrawer = ({
  selected = [],
  setSelected,
  onCheckout
}) => {

  const removeService = (id)=>{

    setSelected(
      selected.filter(s=>s.id !== id)
    );

  };

  const total = selected.reduce(
    (sum,s)=>sum + (s.price || 0),
    0
  );

  if(selected.length === 0){
    return null;
  }

  return(

    <div style={styles.drawer}>

      <h3 style={{marginBottom:"10px"}}>
        Selected Services
      </h3>

      {selected.map(service=>(

        <div
          key={service.id}
          style={styles.row}
        >

          <div>

            <strong>
              {service.name}
            </strong>

            <p style={{opacity:0.6,fontSize:"13px"}}>
              ₱{service.price}
            </p>

          </div>

          <button
            style={styles.removeBtn}
            onClick={()=>removeService(service.id)}
          >
            ✕
          </button>

        </div>

      ))}

      <hr style={{margin:"12px 0"}}/>

      <div style={styles.totalRow}>

        <strong>Total</strong>

        <strong>
          ₱{total.toLocaleString()}
        </strong>

      </div>

      {onCheckout && (

        <button
          style={styles.checkoutBtn}
          onClick={onCheckout}
        >
          Continue Booking
        </button>

      )}

    </div>

  );

};

const styles = {

drawer:{
position:"fixed",
right:"0",
top:"0",
width:"300px",
height:"100vh",
background:"#020617",
padding:"20px",
borderLeft:"1px solid #334155",
color:"#e2e8f0",
overflowY:"auto"
},

row:{
display:"flex",
justifyContent:"space-between",
alignItems:"center",
marginBottom:"10px"
},

removeBtn:{
background:"transparent",
border:"none",
color:"#ef4444",
fontSize:"16px",
cursor:"pointer"
},

totalRow:{
display:"flex",
justifyContent:"space-between",
marginTop:"10px"
},

checkoutBtn:{
marginTop:"14px",
width:"100%",
padding:"10px",
border:"none",
borderRadius:"8px",
background:"#38bdf8",
fontWeight:"600",
cursor:"pointer"
}

};

export default CartDrawer;
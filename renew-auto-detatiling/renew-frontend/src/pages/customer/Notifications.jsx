import { useEffect, useState } from "react";
import CustomerSidebar from "../../components/CustomerSideBar";

const Notifications = () => {

  const token = localStorage.getItem("token");

  const [notifications,setNotifications] = useState([]);
  const [loading,setLoading] = useState(true);

useEffect(() => {

  if (!token) return;

  const loadNotifications = async () => {

    try {

      const res = await fetch(
        "http://localhost:5000/api/notifications",
        {
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );

      let data;

      try {
        data = await res.json();
      } catch {
        throw new Error("Invalid server response");
      }

      setNotifications(data.notifications || []);

    } catch (err) {

      console.log("Notifications fetch error", err);

    } finally {
      setLoading(false);
    }

  };

  loadNotifications();

}, [token]);

  const markRead = async (id)=>{

    try{

      await fetch(
        `http://localhost:5000/api/notifications/${id}/read`,
        {
          method:"PATCH",
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );

      setNotifications(prev =>
        prev.map(n =>
          n.id === id
            ? { ...n, isRead:true }
            : n
        )
      );

    }catch(err){

      console.log(err);

    }

  };

  return (

    <div style={styles.page}>

      <CustomerSidebar active="notifications"/>

      <div style={styles.main}>

        <h1 style={styles.title}>
          Notifications
        </h1>

        {loading && <p style={{color:"var(--text-secondary)"}}>Loading notifications...</p>}

        {!loading && notifications.length === 0 && (
          <p style={{color:"var(--text-secondary)"}}>No notifications yet.</p>
        )}

        <div style={styles.list}>

          {notifications.map(n=>(

            <div
              key={n.id}
              style={{
                ...styles.card,
                background:n.isRead ? "var(--bg-secondary)" : "var(--bg-tertiary)"
              }}
              onClick={()=>markRead(n.id)}
            >

              <div style={styles.row}>

                <strong style={{color:"var(--text-primary)"}}>{n.title || "Notification"}</strong>

                {!n.isRead && (
                  <span style={styles.unread}>
                    New
                  </span>
                )}

              </div>

              <p style={styles.message}>
                {n.message}
              </p>

              {n.createdAt && (

                <p style={styles.date}>
                  {new Date(n.createdAt).toLocaleString()}
                </p>

              )}

            </div>

          ))}

        </div>

      </div>

    </div>

  );

};

const styles = {

  page:{
    display:"flex",
    background:"var(--bg-primary)",
    minHeight:"100vh",
    fontFamily:"Poppins, system-ui"
  },

  main:{
    marginLeft:"250px",
    padding:"40px",
    width:"100%",
    color:"var(--text-primary)"
  },

  title:{
    marginBottom:"30px",
    color:"var(--text-primary)"
  },

  list:{
    display:"flex",
    flexDirection:"column",
    gap:"14px"
  },

  card:{
    padding:"18px",
    borderRadius:"12px",
    cursor:"pointer",
    background:"var(--bg-secondary)",
    border:"1px solid var(--border-color)"
  },

  row:{
    display:"flex",
    justifyContent:"space-between",
    marginBottom:"6px"
  },

  unread:{
    background:"var(--accent-blue)",
    color:"white",
    padding:"2px 8px",
    borderRadius:"6px",
    fontSize:"12px"
  },

  message:{
    opacity:0.9,
    marginBottom:"6px",
    color:"var(--text-secondary)"
  },

  date:{
    fontSize:"12px",
    opacity:0.6,
    color:"var(--text-secondary)"
  }

};

export default Notifications;
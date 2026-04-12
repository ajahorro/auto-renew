import { useEffect, useState } from "react";

/* ADMIN CUSTOMERS */

const AdminCustomers = () => {

  const token = localStorage.getItem("token");

  const [customers,setCustomers] = useState([]);
  const [filtered,setFiltered] = useState([]);
  const [loading,setLoading] = useState(true);
  const [search,setSearch] = useState("");

  useEffect(()=>{

    loadCustomers();

  },[]);

  /* LOAD CUSTOMERS */

  const loadCustomers = async ()=>{

    try{

      const res = await fetch(
        "http://localhost:5000/api/users?role=CUSTOMER",
        {
          headers:{
            Authorization:`Bearer ${token}`
          }
        }
      );

      const data = await res.json();

      const list =
        Array.isArray(data) ? data :
        Array.isArray(data.users) ? data.users : [];

      setCustomers(list);
      setFiltered(list);

    }catch(err){

      console.log("Customers fetch error",err);

    }finally{

      setLoading(false);

    }

  };

  /* SEARCH */

  const handleSearch = (value)=>{

    setSearch(value);

    const filteredList = customers.filter(c =>
      c?.fullName?.toLowerCase().includes(value.toLowerCase()) ||
      c?.email?.toLowerCase().includes(value.toLowerCase())
    );

    setFiltered(filteredList);

  };

  return(

    <div style={styles.page}>

      <h1 style={styles.title}>
        Customers
      </h1>

      {/* SEARCH */}

      <input
        placeholder="Search customers..."
        value={search}
        onChange={(e)=>handleSearch(e.target.value)}
        style={styles.search}
      />

      {/* CUSTOMER LIST */}

      <div style={styles.card}>

        {loading && <p>Loading customers...</p>}

        {!loading && filtered.length === 0 && (
          <p>No customers found.</p>
        )}

        {filtered.map(c=>(

          <div key={c.id} style={styles.row}>

            <div>

              <strong>{c.fullName}</strong>

              <p style={{opacity:0.7}}>
                {c.email}
              </p>

            </div>

            <span style={styles.role}>
              CUSTOMER
            </span>

          </div>

        ))}

      </div>

    </div>

  );

};

const styles = {

  page:{
    background:"#020617",
    minHeight:"100vh",
    padding:"40px",
    color:"#e2e8f0",
    fontFamily:"Poppins, system-ui"
  },

  title:{
    marginBottom:"20px"
  },

  search:{
    padding:"10px",
    width:"300px",
    borderRadius:"6px",
    border:"1px solid #334155",
    background:"#020617",
    color:"white",
    marginBottom:"20px"
  },

  card:{
    background:"#0f172a",
    padding:"20px",
    borderRadius:"14px"
  },

  row:{
    display:"flex",
    justifyContent:"space-between",
    marginTop:"10px"
  },

  role:{
    background:"#334155",
    padding:"4px 10px",
    borderRadius:"6px",
    fontSize:"12px"
  }

};

export default AdminCustomers;
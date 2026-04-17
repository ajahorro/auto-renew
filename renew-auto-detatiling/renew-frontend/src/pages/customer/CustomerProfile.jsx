import { useEffect, useState } from "react";
import CustomerSideBar from "../../components/CustomerSideBar";

const CustomerProfile = () => {

  const token = localStorage.getItem("token");

  const [user,setUser] = useState({
    fullName:"",
    email:"",
    createdAt:"",
    avatarUrl:""
  });

  /* ===============================
  NEW: NAME EDIT STATE
  =============================== */

  const [newName,setNewName] = useState("");

  const [newPassword,setNewPassword] = useState("");
  const [confirmPassword,setConfirmPassword] = useState("");

  const [avatar,setAvatar] = useState(null);

  /* ===============================
  LOAD PROFILE
  =============================== */

  useEffect(()=>{

    const loadProfile = async()=>{

      try{

        const res = await fetch("http://localhost:5000/api/me",{
          headers:{
            Authorization:`Bearer ${token}`
          }
        });

        const data = await res.json();

        /* SAFETY CHECK */

        if(data && data.user){

          setUser({
            fullName:data.user.fullName || "",
            email:data.user.email || "",
            createdAt:data.user.createdAt || "",
            avatarUrl:data.user.avatarUrl || ""
          });

          /* preload editable name safely */

          setNewName(data.user.fullName || "");

        }

      }catch(err){

        console.error("Profile load error",err);

      }

    };

    loadProfile();

  },[token]);

  /* ===============================
  AVATAR UPLOAD
  =============================== */

  const handleAvatarChange = (e)=>{

    const file = e.target.files[0];

    if(!file) return;

    setAvatar(URL.createObjectURL(file));

  };

  /* ===============================
  UPDATE NAME
  =============================== */

  const updateName = async()=>{

    if(!newName || newName.trim()===""){

      alert("Name cannot be empty.");
      return;

    }

    try{

      const res = await fetch(
        "http://localhost:5000/api/users/me",
        {
          method:"PATCH",
          headers:{
            "Content-Type":"application/json",
            Authorization:`Bearer ${token}`
          },
          body:JSON.stringify({
            fullName:newName
          })
        }
      );

      if(!res.ok){

        alert("Failed to update name.");
        return;

      }

      await res.json();

      /* update UI */

      setUser(prev=>({
        ...prev,
        fullName:newName
      }));

      alert("Name updated successfully.");

    }catch(err){

      console.error("Name update error",err);

    }

  };

  /* ===============================
  PASSWORD EMAIL REQUEST
  =============================== */

  const requestPasswordChange = async()=>{

    if(!newPassword || !confirmPassword){

      alert("Please fill in both password fields.");
      return;

    }

    if(newPassword !== confirmPassword){

      alert("Passwords do not match.");
      return;

    }

    try{

      const res = await fetch(
        "http://localhost:5000/api/users/me/password",
        {
          method:"PATCH",
          headers:{
            "Content-Type":"application/json",
            Authorization:`Bearer ${token}`
          },
          body:JSON.stringify({
            currentPassword: "",
            newPassword: newPassword
          })
        }
      );

      if(!res.ok){

        alert("Failed to send verification email.");
        return;

      }

      alert("Verification email sent. Please confirm in your inbox.");

      setNewPassword("");
      setConfirmPassword("");

    }catch(err){

      console.error("Password request error",err);

    }

  };

  /* ===============================
  MEMBER SINCE FORMAT
  =============================== */

  const memberSince = user.createdAt
    ? new Date(user.createdAt).toLocaleDateString(undefined,{
        year:"numeric",
        month:"long"
      })
    : "";

  const avatarLetter = user.fullName
    ? user.fullName.charAt(0).toUpperCase()
    : "?";

  return(

    <div className="dashboard-container">

      <CustomerSideBar active="profile" />

      <div className="dashboard-main">

        <h1>Profile</h1>

        {/* PROFILE HEADER */}

        <div className="card" style={{marginBottom:"25px"}}>

          <div style={{
            display:"flex",
            alignItems:"center",
            gap:"20px"
          }}>

            <div style={{
              width:"80px",
              height:"80px",
              borderRadius:"50%",
              background:"#404F68",
              display:"flex",
              alignItems:"center",
              justifyContent:"center",
              fontSize:"32px",
              color:"white"
            }}>
              {avatar ? (
                <img
                  src={avatar}
                  alt="avatar"
                  style={{
                    width:"100%",
                    height:"100%",
                    borderRadius:"50%",
                    objectFit:"cover"
                  }}
                />
              ) : (
                avatarLetter
              )}
            </div>

            <div>

              <h2>{user.fullName || "Customer"}</h2>

              <p style={{opacity:"0.7"}}>
                {user.email || ""}
              </p>

              <input
                type="file"
                accept="image/*"
                onChange={handleAvatarChange}
                style={{marginTop:"10px"}}
              />

            </div>

          </div>

        </div>

        {/* ACCOUNT SUMMARY */}

        <div className="card" style={{marginBottom:"25px"}}>

          <h3>Account Summary</h3>

          <div style={{marginTop:"15px"}}>

            <p style={{fontWeight:"600"}}>Full Name</p>

            <input
              type="text"
              value={newName || ""}
              onChange={(e)=>setNewName(e.target.value)}
              style={{
                width:"100%",
                padding:"8px",
                marginTop:"6px"
              }}
            />

            <button
              onClick={updateName}
              style={{
                marginTop:"10px",
                padding:"8px 14px",
                border:"none",
                borderRadius:"6px",
                background:"#404F68",
                color:"white",
                cursor:"pointer"
              }}
            >
              Update Name
            </button>

          </div>

          <div style={{marginTop:"15px"}}>

            <p style={{fontWeight:"600"}}>Email</p>
            <p style={{opacity:"0.8"}}>{user.email || ""}</p>

          </div>

          <div style={{marginTop:"15px"}}>

            <p style={{fontWeight:"600"}}>Member Since</p>
            <p style={{opacity:"0.8"}}>{memberSince}</p>

          </div>

        </div>

        {/* SECURITY */}

        <div className="card">

          <h3>Account Security</h3>

          <div style={{marginTop:"15px"}}>

            <label>New Password</label>

            <input
              type="password"
              value={newPassword || ""}
              onChange={(e)=>setNewPassword(e.target.value)}
              style={{
                width:"100%",
                marginTop:"6px",
                padding:"8px"
              }}
            />

          </div>

          <div style={{marginTop:"15px"}}>

            <label>Confirm Password</label>

            <input
              type="password"
              value={confirmPassword || ""}
              onChange={(e)=>setConfirmPassword(e.target.value)}
              style={{
                width:"100%",
                marginTop:"6px",
                padding:"8px"
              }}
            />

          </div>

          <button
            onClick={requestPasswordChange}
            style={{
              marginTop:"20px",
              padding:"10px 16px",
              border:"none",
              borderRadius:"6px",
              background:"#404F68",
              color:"white",
              cursor:"pointer"
            }}
          >
            Send Verification Email
          </button>

        </div>

      </div>

    </div>

  );

};

export default CustomerProfile;
import React, { useContext, useState } from "react";
import axios from "axios";
import { UserContext } from "./UserContext";

const Profile = () => {
  const { user, saveUser } = useContext(UserContext);
  const [formData, setFormData] = useState(user || { username: "", email: "" });
  const [message, setMessage] = useState("");

  if (!user) return <p>Please login/register first.</p>;

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.put(`http://localhost:5000/profile/${user.id}`, formData);
      saveUser(res.data.user); // update global + localStorage
      setMessage("Profile updated successfully!");
    } catch (err) {
      setMessage("Update failed!");
    }
  };

  return (
    <div className="profile-container">
      <h2>Your Profile</h2>
      <form onSubmit={handleUpdate}>
        <label>Username</label>
        <input type="text" name="username" value={formData.username} onChange={handleChange} />

        <label>Email</label>
        <input type="email" name="email" value={formData.email} onChange={handleChange} />

        <button type="submit">Update Profile</button>
      </form>
      {message && <p>{message}</p>}
    </div>
  );
};

export default Profile;

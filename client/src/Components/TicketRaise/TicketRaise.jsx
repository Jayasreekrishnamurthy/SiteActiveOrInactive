import React, { useState } from "react";
import "../Style/TicketRaise.css";

function TicketRaise() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    subject: "",
    message: "",
  });

  const [imageFile, setImageFile] = useState(null);
  const [status, setStatus] = useState("");
  const [dragging, setDragging] = useState(false);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setImageFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formDataObj = new FormData();
    Object.keys(formData).forEach((key) => {
      formDataObj.append(key, formData[key]);
    });
    if (imageFile) formDataObj.append("image", imageFile);

    try {
      const response = await fetch("http://localhost:5000/api/contact", {
        method: "POST",
        body: formDataObj,
      });
      const data = await response.json();
      if (response.ok) {
        setStatus("✅ Email sent successfully!");
        setFormData({ name: "", email: "", phone: "", subject: "", message: "" });
        setImageFile(null);
      } else {
        setStatus("❌ " + data.error);
      }
    } catch (error) {
      console.error("Error:", error);
      setStatus("❌ Failed to send message.");
    }
  };

  return (
    <div className="form-container">
      <form onSubmit={handleSubmit} className="contact-form">
        <h2>Ticket Raised</h2>
        <p className="subtitle">Please provide the details of the problem</p>

        <div className="name-container">
          <div className="input-group">
            <input
              type="text"
              name="name"
              className="input"
              placeholder="Your Name"
              value={formData.name}
              onChange={handleChange}
              required
            />
          </div>
          <div className="input-group">
            <input
              type="email"
              name="email"
              className="input"
              placeholder="Your Email"
              value={formData.email}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        <div className="input-group">
          <input
            type="text"
            name="phone"
            className="input"
            placeholder="Phone"
            value={formData.phone}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <input
            type="text"
            name="subject"
            className="input"
            placeholder="Subject"
            value={formData.subject}
            onChange={handleChange}
            required
          />
        </div>

        <div className="input-group">
          <textarea
            name="message"
            className="textarea"
            placeholder="Your Message"
            value={formData.message}
            onChange={handleChange}
            required
          />
        </div>

        <div
          className={`upload-area ${dragging ? "dragging" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => document.getElementById("fileInput").click()}
        >
          <div className="upload-content">
            <span className="upload-text">
              {imageFile ? `Selected: ${imageFile.name}` : "Drag & drop an image or click to upload"}
            </span>
          </div>
          <input
            id="fileInput"
            type="file"
            className="file-input"
            accept="image/*"
            onChange={handleFileChange}
          />
        </div>

        <button type="submit" className="submit-button">
          Send
        </button>

        <p className="status">{status}</p>
      </form>
    </div>
  );
}

export default TicketRaise;

// ดึงไฟล์ header.html มาแสดงผล 
fetch("header.html") 
  .then(res => { 
    if(res.ok) return res.text(); 
    throw new Error('Header not found'); 
  }) 
  .then(data => { 
    document.getElementById("header-placeholder").innerHTML = data; 
    // โหลด Script ที่อาจติดมากับ Header 
    const scripts = document.getElementById("header-placeholder").querySelectorAll("script"); 
    scripts.forEach(oldScript => { 
      const newScript = document.createElement("script"); 
      if(oldScript.src) { newScript.src = oldScript.src; }  
      else { newScript.textContent = oldScript.textContent; } 
      document.body.appendChild(newScript); 
      oldScript.remove(); 
    }); 
  }) 
  .catch(err => console.log("Header external file template load skip.")); 
 
// ดึงไฟล์ footer.html มาแสดงผล 
fetch("footer.html") 
  .then(res => { 
    if(res.ok) return res.text(); 
    throw new Error('Footer not found'); 
  }) 
  .then(data => { 
    document.getElementById("footer-placeholder").innerHTML = data; 
  }) 
  .catch(err => console.log("Footer external file template load skip.")); 

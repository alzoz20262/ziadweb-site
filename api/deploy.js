
export default async function handler(req, res) {
// CORS
res.setHeader("Access-Control-Allow-Origin", "*");
res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
res.setHeader("Access-Control-Allow-Headers", "Content-Type");

// OPTIONS
if (req.method === "OPTIONS") {
return res.status(200).end();
}

// Only POST
if (req.method !== "POST") {
return res.status(405).json({
error: "Method not allowed"
});
}

try {
// Vercel API Token
const token = process.env.VERCEL_API_TOKEN;

if (!token) {  
  return res.status(500).json({  
    error: "VERCEL_API_TOKEN is missing"  
  });  
}  

// Receive request body  
const body = req.body;  

// Check files  
if (  
  !body ||  
  !Array.isArray(body.files) ||  
  body.files.length === 0  
) {  
  return res.status(400).json({  
    error: "No files received"  
  });  
}  

// Prepare files for Vercel  
const files = body.files  
  .map((file) => ({  
    file: String(file.file || file.path || ""),  
    data: String(file.data || "")  
  }))  
  .filter((file) => file.file && file.data);  

// Make sure files aren't empty  
if (files.length === 0) {  
  return res.status(400).json({  
    error: "Files are empty"  
  });  
}  

// Existing Vercel project  
const projectName = "z-deploy";  

// Create deployment inside existing project  
const response = await fetch(  
  "https://api.vercel.com/v13/deployments",  
  {  
    method: "POST",  

    headers: {  
      Authorization: `Bearer ${token}`,  
      "Content-Type": "application/json"  
    },  

    body: JSON.stringify({  
      name: projectName,  

      files: files,  

      target: "production"  
    })  
  }  
);  

// Read Vercel response  
const result = await response.json();  

// Vercel returned an error  
if (!response.ok) {  
  console.error(  
    "Vercel API Error:",  
    JSON.stringify(result, null, 2)  
  );  

  return res.status(response.status).json({  
    error:  
      result?.error?.message ||  
      result?.message ||  
      "Vercel deployment failed",  

    details: result  
  });  
}  

// Deployment URL  
const url = result.url  
  ? `https://${result.url}`  
  : null;  

// Make sure URL exists  
if (!url) {  
  return res.status(500).json({  
    error: "Deployment created but Vercel did not return a URL",  

    deployment: result  
  });  
}  

// Success  
return res.status(200).json({  
  success: true,  

  id: result.id,  

  url: url,  

  project: projectName,  

  deployment: result  
});

} catch (error) {
console.error(
"Deploy Error:",
error
);

return res.status(500).json({  
  error:  
    error?.message ||  
    "Internal server error"  
});

}
}

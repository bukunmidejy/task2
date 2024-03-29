// Defining a function to display error message
function printError(elemId, hintMsg) {
    document.getElementById(elemId).innerHTML = hintMsg;
}

// Defining a function to validate form 
function validateForm() {
    // Retrieving the values of form elements 
    var name = document.contactForm.name.value;
    var email = document.contactForm.email.value;
    var message = document.contactForm.message.value;
        }
    
    
	// Defining error variables with a default value
    var nameErr = emailErr = messageErr = true;
    
    // Validate name
    if(name == "") {
        printError("nameErr", "Please enter your name");
    } else {
        var regex = /^[a-zA-Z\s]+$/;                
        if(regex.test(name) === false) {
            printError("nameErr", "Please enter a valid name");
        } else {
            printError("nameErr", "");
            nameErr = false;
        }
    }
    
    // Validate email address
    if(email == "") {
        printError("emailErr", "Please enter your email address");
    } else {
        // Regular expression for basic email validation
        var regex = /^\S+@\S+\.\S+$/;
        if(regex.test(email) === false) {
            printError("emailErr", "Please enter a valid email address");
        } else{
            printError("emailErr", "");
            emailErr = false;
        }
    }
    
    // Validate message
    if(mobile == "") {
        printError("messageErr", "Please enter your message");
    } else {
        var regex =  /^[a-zA-Z\s]+$/;
        if(regex.test(message) === false) {
            printError("messageErr", "Please enter your message not less than 20 words");
        } else{
            printError("mobileErr", "");
            mobileErr = false;
        }
    }
    
    
    
    
    
    // Prevent the form from being submitted if there are any errors
    if((nameErr || emailErr || messagrErr) == true) {
       return false;
    } else {
        // Creating a string from input data for preview
        var dataPreview = "You've entered the following details: \n" +
                          "Full Name: " + name + "\n" +
                          "Email Address: " + email + "\n" +
                          "Message: " + message + "\n" +
                          
        
        
        // Display input data in a dialog box before submitting the form
        alert(dataPreview);
    }
};
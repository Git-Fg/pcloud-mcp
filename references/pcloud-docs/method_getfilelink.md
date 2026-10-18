# pCloud docs: methods/streaming/getfilelink.html

> Source: https://docs.pcloud.com/methods/streaming/getfilelink.html

## getfilelink

This method can't be used from web applications. Referrer is restricted to pcloud.com.

Name

getfilelink

Auth

yes

Description

Get a download link for file Takes fileid (or path) as parameter and provides links from which the file can be downloaded.\
\
If the optional parameter forcedownload is set, the file will be served by the content server with content type *application/octet-stream*, which typically forces user agents to save the file.\
\
Alternatively you can provide parameter contenttype with the *Content-Type* you wish the content server to send. If these parameters are not set, the content type will depend on the extension of the file.\
\
Parameter maxspeed may be used if you wish to limit the download speed (in bytes per second) for this download.\
\
Finally you can set skipfilename so the link generated will not include the name of the file.

URL

https://api.pcloud.com/getfilelink

Required

|            |                                 |
|------------|---------------------------------|
| Parameter  | Description                     |
| **fileid** | int ID of the renamed file      |
| **path**   | string Path to the renamed file |

Use fileid or path

Optional

|  |  |
|----|----|
| Parameter | Description |
| **forcedownload** | int Download with *Content-Type* = *application/octet-stream* |
| **contenttype** | string Set *Content-Type* |
| **maxspeed** | int limit the download speed |
| **skipfilename** | int include the name of the file in the generated link |

Output

On success it will return array hosts with servers that have the file. The first server is the one we consider best for current download.\
\
In path there will be a request you should send to server.\
\
You need to construct the URL yourself by concatenating http:// or https:// with one of the hosts (first one) and the path.

Example

{\
    result: 0,\
    path: "/hash/My%20picture.jpg",\
    expires: "Thu, 03 Oct 2013 01:06:49 +0000",\
    hosts: \[\
        "c63.pcloud.com",\
        "c1.pcloud.com"\
    \]\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **1005** | Unknown content-type requested. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **2011** | Requested speed limit too low, see minspeed for minimum. |
| **4000** | Too many login tries from this IP address. |
| **5002** | Internal error, no servers available. Try again later. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

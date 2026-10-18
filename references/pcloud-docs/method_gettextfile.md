# pCloud docs: methods/streaming/gettextfile.html

> Source: https://docs.pcloud.com/methods/streaming/gettextfile.html

## gettextfile

This method can't be used from web applications. Referrer is restricted to pcloud.com.

Name

gettextfile

Auth

yes

Description

Download a file in different character encoding Takes fileid (or path) as parameter and returns contents of the file in different character encoding. The file is streamed as response to this method by the content server.\
\
Optional parameter fromencoding specify the original character encoding of the file. If ommited it will be guessed based on the contents of the file.\
\
Optional parameter toencoding specify the requested character encoding for the output. The default is utf-8.\
\
If the optional parameter forcedownload is set, the file will be served by the server with content type *application/octet-stream*, which typically forces user agents to save the file.\
\
Alternatively you can provide parameter contenttype with the *Content-Type* you wish the server to send. If these parameters are not set, the content type will depend on the extension of the file.

URL

https://api.pcloud.com/gettextfile

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
| **fromencoding** | string the original character encoding of the file (default: guess) |
| **toencoding** | string requested character encoding of the output (default: utf-8) |
| **forcedownload** | int Download with *Content-Type* = *application/octet-stream* |
| **contenttype** | string Set *Content-Type* |

Output

On success this method outputs the data by the API server. No links to content servers are provided. Unless you provide invalid encodings in fromecoding or toencoding you can safely assume that this method will not fail.

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
| **2061** | Unsupported character set in 'fromecoding' or 'toencoding'. |
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

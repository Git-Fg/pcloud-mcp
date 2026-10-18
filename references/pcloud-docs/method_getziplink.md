# pCloud docs: methods/archiving/getziplink.html

> Source: https://docs.pcloud.com/methods/archiving/getziplink.html

## getziplink

Name

getziplink

Auth

yes

Description

Receive a zip file link for files in the user's filesystem.\
\
Recognizes the same parameters as [getzip](/methods/archiving/getzip.html).\
\
Expects as parameter a defined [tree](/structures/tree.html).\
\
Unlike getzip, returns a download link(s) the same way [getfilelink](/methods/streaming/getfilelink.html) does - returns path, hosts and expire.

**Note :** This call is less efficient than [getzip](/methods/archiving/getzip.html) as the zip archive is created on our servers and only then you get a download link. So as fast as our servers are, it may take time to create a large archive.

The parameter maxspeed may be used if you wish to limit the download speed (in bytes per second) for this link.

URL

https://api.pcloud.com/getziplink

Optional

[TABLE]

Output

On success it will return array hosts with servers that have the file.\
\
The first server is the one we consider best for current download.\
\
In path there will be a request you should send to server.\
\
You need to construct the URL yourself by concatenating http:// or https:// with one of the hosts (first one) and the path.

Example

{\
    result: 0,\
    path: "/dFZ73Y0ZtdPJZ3lZZhipqC7ZNVZZmb0ZHQp8Ed85S8HL874JvyYgMY8C1tbk/My%20picture.jpg",\
    expires: "Thu, 03 Oct 2013 01:06:49 +0000",\
    hosts: \[\
        "c63.pcloud.com",\
        "c1.pcloud.com"\
    \]\
}\

### Errors

|          |                                                          |
|----------|----------------------------------------------------------|
| Code     | Description                                              |
| **1000** | Log in required.                                         |
| **1017** | Invalid 'folderid' provided.                             |
| **1018** | Invalid 'fileid' provided.                               |
| **2000** | Log in failed.                                           |
| **2009** | File not found.                                          |
| **2011** | Requested speed limit too low, see minspeed for minimum. |
| **4000** | Too many login tries from this IP address.               |
| **5001** | Internal upload error.                                   |
| **5002** | Internal error, no servers available. Try again later.   |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

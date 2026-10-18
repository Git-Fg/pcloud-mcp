# pCloud docs: methods/revisions/revertrevision.html

> Source: https://docs.pcloud.com/methods/revisions/revertrevision.html

## revertrevision

Name

revertrevision

Auth

yes

Description

Takes fileid/path and revisionid as parameters and reverts the file to a given revision.\
\
Current file contents are saved as new revision.

URL

https://api.pcloud.com/revertrevision

Required

|                |                                                        |
|----------------|--------------------------------------------------------|
| Parameter      | Description                                            |
| **fileid**     | int id of the reverted file                            |
| **path**       | string path the reverted file                          |
| **revisionid** | int id of the revistion, to which the file is reverted |

Use fileid or path

Output

On success returns new [metadata](/structures/metadata.html) of the file.

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1004** | No fileid or path provided. |
| **2000** | Log in failed. |
| **2002** | A component of parent directory does not exist. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2009** | File not found. |
| **2010** | Invalid path. |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later. |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

# pCloud docs: methods/revisions/listrevisions.html

> Source: https://docs.pcloud.com/methods/revisions/listrevisions.html

## listrevisions

Name

listrevisions

Auth

yes

Description

Lists revisions for a given fileid / path

URL

https://api.pcloud.com/listrevisions

Required

|            |                                 |
|------------|---------------------------------|
| Parameter  | Description                     |
| **fileid** | int id of the revisioned file   |
| **path**   | string path the revisioned file |

Use fileid or path

Output

Lists the revisions as array, each element with the following fields:

|  |  |
|----|----|
| Field | Description |
| **revisionid** | int id of the revision |
| **size** | int filesize of the given revision of the file |
| **hash** | string file contents hash (same as in [metadata](/structures/metadata.html)) |
| **created** | datetime date/time at which the revision was created |

Also returns the [metadata](/structures/metadata.html) of the file.

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

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

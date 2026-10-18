# pCloud docs: methods/folder/deletefolderrecursive.html

> Source: https://docs.pcloud.com/methods/folder/deletefolderrecursive.html

## deletefolderrecursive

Name

deletefolderrecursive

Auth

yes

Description

Deletes a folder\
\
Expects either path string parameter (discouraged) or int folderid parameter.

**Note:** This function deletes files, directories, and removes sharing. Use with extreme care.

URL

https://api.pcloud.com/deletefolderrecursive

Required

|              |                                         |
|--------------|-----------------------------------------|
| Parameter    | Description                             |
| **path**     | string path to the folder (discouraged) |
| **folderid** | int id of the folder                    |

Output

Upon success returns int deletedfiles - the number of deleted files and int deletedfolders - number of deleted folders.

Example

{\
    "result": 0,\
    "deletedfiles": 30,\
    "deletedfolders": 5\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **2000** | Log in failed. |
| **2003** | Access denied. You do not have permissions to preform this operation. |
| **2005** | Directory does not exist. |
| **2006** | Folder is not empty. |
| **2007** | Cannot delete the root folder. |
| **2028** | There are active shares or sharerequests for this folder. |
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

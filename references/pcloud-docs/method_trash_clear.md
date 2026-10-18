# pCloud docs: methods/trash/trash_clear.html

> Source: https://docs.pcloud.com/methods/trash/trash_clear.html

## trash_clear

Name

trash_clear

Auth

yes

Description

Deletes **permanently** files or folders from the Trash.

Files and folders deleted via this method cannot be restored.

If folderid='0', then all data from the Trash will be removed.

URL

https://api.pcloud.com/trash_clear

Required

|              |                                                        |
|--------------|--------------------------------------------------------|
| Parameter    | Description                                            |
| **fileid**   | int file id of the file that is removed from Trash     |
| **folderid** | int folder id of the folder that is removed from Trash |

Use fileid or folderid

Example

{\
    "result": 0\
}\

### Errors

|          |                                            |
|----------|--------------------------------------------|
| Code     | Description                                |
| **1000** | Log in required.                           |
| **1017** | Invalid 'folderid' provided.               |
| **1018** | Invalid 'fileid' provided.                 |
| **1053** | Please provide 'fileid' or 'folderid'.     |
| **2000** | Log in failed.                             |
| **2005** | Directory does not exist.                  |
| **2009** | File not found.                            |
| **4000** | Too many login tries from this IP address. |
| **5000** | Internal error. Try again later.           |

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

# pCloud docs: methods/sharing/sharefolder.html

> Source: https://docs.pcloud.com/methods/sharing/sharefolder.html

## sharefolder

Name

sharefolder

Auth

yes

Description

Shares a folder with another user.\
\
Share may be subject to confirmation from the other user. The folder to be shared is identified by folderid or path.\
\
Optional share name can be provided, if it is not, the folder name is used as sharename. Implementations are advised to give opportunity to the sharing user to select the share name, which should be pre-filled with the folder name.\
\
The required parameter mail holds the email address of the user with whom you are sharing the folder.\
\
The required parameter permissions sets the permissions for the folder.\
\
Zero for read-only or any combination (sum/or) of

|       |                   |
|-------|-------------------|
| Flag  | Description       |
| **1** | Create permission |
| **2** | Modify permission |
| **4** | Delete permission |

Optional parameter message allows adding a message to pass to the receiving user.\
\
Folder sharing is a complicated operation and the following errors are likely to be returned:

|  |  |
|----|----|
| Code | Description |
| **2014** | the user's address is not verified. Implementations are advised upon user confirmation to call sendverificationemail and to ask the user to check his/her email. |
| **2015** | root folder cannot be shared, this check SHOULD also be performed on the client. |
| **2016** | one can only share folders with ismine set to true, implementations SHOULD check this locally too. |
| **2017** | user does not accept requests from you or from anybody, implementations can not know if this is going to happen, but are expected to act appropriately on this error. |

URL

https://api.pcloud.com/sharefolder

Required

|  |  |
|----|----|
| Parameter | Description |
| **folderid** | int folder id of the shared folder |
| **path** | string path to the shared folder |
| **mail** | string mail of the user with whom you are sharing the folder |
| **permissions** | int bitwise combination of permission flags |

Use path or folderid

Optional

|             |                                                      |
|-------------|------------------------------------------------------|
| Parameter   | Description                                          |
| **name**    | string name of the share. Default - the folder name. |
| **message** | string message to pass to the receiving user.        |

Example

{\
    result: 0\
}\

### Errors

|  |  |
|----|----|
| Code | Description |
| **1000** | Log in required. |
| **1002** | No full path or folderid provided. |
| **1023** | Please provide 'mail' to share folder with. |
| **1024** | Please provide 'permissions' for the share. |
| **2000** | Log in failed. |
| **2001** | Invalid file/folder name. |
| **2005** | Directory does not exist. |
| **2014** | Please verify your email address to preform this action. |
| **2015** | Can not share root folder. |
| **2016** | You can only share your own folders. |
| **2017** | User does not accept shares. |
| **2018** | Invalid 'mail' provided. |
| **2019** | Share request already exists. |
| **2020** | You can't share a folder with yourself. |
| **2024** | User already has access to this folder or subfolder of this folder. |
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

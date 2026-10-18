# pCloud docs: structures/filenames.html

> Source: https://docs.pcloud.com/structures/filenames.html

# Filenames

File and folder names are in **UTF8 encoding**. They must be shorter than **1024 bytes** (not characters). Filenames are *case sensitive*. There MUST NOT be two files or two folders with the same name in the same folder.

**Important Note:** However a file and a folder may share a name even when they are in the same folder. Since most operations are different for files and folders, that should not be a problem.

Deleted folders do not have unique names - there might be many deleted folders with the same name in the same folder. Deleted files still have unique names. When a new file is created with the same name in the same folder old fileid is reused and contents of the old file are saved as revision. Generally all characters are allowed in filenames, except the NULL byte, forward and backslash (/,\\ and \0).

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

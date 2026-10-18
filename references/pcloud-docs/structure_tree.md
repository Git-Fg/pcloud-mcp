# pCloud docs: structures/tree.html

> Source: https://docs.pcloud.com/structures/tree.html

# Defining a tree (set of files and folders)

Some methods can work with trees - that is set of files and folders, where folders can have files and subfolders inside them and so on. Because defining a tree is more complicated than just passing a single parameter, this section is dedicated to explaining how to do this and methods just mention that they work with input tree.\
\
A tree is defined by using one or more of the following parameters: folderid, folderids, fileids, excludefolderids, excludefileids.

|  |  |
|----|----|
| Field | Description |
| **folderid** | If set, contents of the folder with the given id will appear as root elements of the three. The folder itself does not appear as a part of the structure. |
| **folderids** | If set, defines one or more folders that will appear as folders in the root folder. If multiple folderids are given, they MUST be separated by coma ,. |
| **fileids** | If set, files with corresponding ids will appear in the root folder of the tree structure. If more than one fileid is provided, they MUST be separated by coma ,. |
| **excludefolderids** | If set, folders with the given id will be removed from the tree structure. This is useful when you want to include a folder in the tree structure with some of it's subfolders excluded. |
| **excludefileids** | If set, defines fileids that are not to be included in the tree structure. |

It is not an error not to specify any of these parameters. That will lead to an empty tree.\
\
It is not the same to pass single folderid as folderid and folderids parameter. In the first case in the root directory of the tree you will have as many entries as there are files and folders in the given folder. If a single folderid is passed as folderids, the resulting tree will have exactly one root element - the folder itself and folder's contents will be inside it.\
\
If you do not pass any of folderid, folderids or fileids normally an empty tree is defined. The only exception is creation of a tree from a public link. The default for such a tree is to have one root element with the public link object inside.

[![](/img/footer/github.png)](https://github.com/pCloud)

2014 © pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

© pCloud. [Terms and Conditions](https://www.pcloud.com/terms_and_conditions.html). [Privacy Policy](https://www.pcloud.com/privacy_policy.html). [Intellectual Property](https://www.pcloud.com/int_pr_policy.html).

[![](/img/footer/github.png)](https://github.com/pCloud "GitHub")

Reset Password

Email

Check your e-mail for further instructions.

Reset

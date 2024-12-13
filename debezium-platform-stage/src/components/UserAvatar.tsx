import {
  Dropdown,
  MenuToggleElement,
  MenuToggle,
  Avatar,
  DropdownList,
  DropdownItem,
} from "@patternfly/react-core";
import React, { useState } from "react";
import imgAvatar from "@patternfly/react-core/src/components/assets/avatarImg.svg";

interface UserAvatarProps {

}

const UserAvatar: React.FC<UserAvatarProps> = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const onDropdownSelect = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const onDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const userDropdownItems = [
    <>
      <DropdownItem key="group 2 profile">My profile</DropdownItem>
      <DropdownItem key="group 2 user">User management</DropdownItem>
      <DropdownItem key="group 2 logout">Logout</DropdownItem>
    </>,
  ];

  return (
    <Dropdown
      isOpen={isDropdownOpen}
      onSelect={onDropdownSelect}
      onOpenChange={(isOpen: boolean) => setIsDropdownOpen(isOpen)}
      popperProps={{ position: "right" }}
      toggle={(toggleRef: React.Ref<MenuToggleElement>) => (
        <MenuToggle
          ref={toggleRef}
          onClick={onDropdownToggle}
          isFullHeight
          isExpanded={isDropdownOpen}
          icon={<Avatar src={imgAvatar} alt="" />}
        >
          Username
        </MenuToggle>
      )}
    >
      <DropdownList>{userDropdownItems}</DropdownList>
    </Dropdown>
  );
};

export default UserAvatar;

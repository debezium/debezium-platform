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


const UserAvatar: React.FC = () => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const onDropdownSelect = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const onDropdownToggle = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  const userDropdownItems = [
    <DropdownItem key="profile">My profile</DropdownItem>,
    <DropdownItem key="user">User management</DropdownItem>,
    <DropdownItem key="logout">Logout</DropdownItem>,
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

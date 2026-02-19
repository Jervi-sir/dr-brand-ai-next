'use client';

import type { User } from 'next-auth';
import { usePathname, useRouter } from 'next/navigation';

import { PlusIcon } from '@/components/icons';
import { SidebarHistory } from '@/components/sidebar-history';
import { SidebarUserNav } from '@/components/sidebar-user-nav';
import { Button } from '@/components/ui/button';
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import Link from 'next/link';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';
import { CalendarCheck2Icon, CalendarCogIcon, CalendarDaysIcon, CalendarFoldIcon, CalendarIcon, CalendarOffIcon, CalendarX2Icon, KanbanIcon, KanbanSquareIcon, ListIcon, SplitIcon, SplitSquareHorizontalIcon } from 'lucide-react';
import React from 'react';
import { ExtendedUser } from '@/app/(auth)/types';

export function AppSidebar({ user }: { user: ExtendedUser | undefined }) {
  const router = useRouter();
  const { setOpenMobile } = useSidebar();
  const pathname = usePathname();

  return (
    <Sidebar variant='floating' className="group-data-[side=left]:border-r-0 ">
      <SidebarHeader>
        <SidebarMenu>
          <div className="flex flex-row justify-between items-center">
            <Link
              href="/"
              onClick={() => {
                setOpenMobile(false);
              }}
              className="flex flex-row gap-3 items-center"
            >
              <span className="text-lg font-semibold px-2 hover:bg-muted rounded-md cursor-pointer">
                Dr-brandlin
              </span>
            </Link>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  type="button"
                  className="p-2 h-fit"
                  onClick={() => {
                    setOpenMobile(false);
                    router.push('/');
                    router.refresh();
                  }}
                >
                  <PlusIcon />
                </Button>
              </TooltipTrigger>
              <TooltipContent align="end">New Chat</TooltipContent>
            </Tooltip>
          </div>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {user?.role === 'admin' && (
          <SidebarGroup>
            <div className="px-2 py-1 text-xs text-sidebar-foreground/50">
              Tools
            </div>
            <SidebarGroupContent>
              {[
                { name: 'Split', icon: <SplitSquareHorizontalIcon />, url: '/split' },
                { name: 'Split v2', icon: <SplitSquareHorizontalIcon />, url: '/split-v2' },
                { name: 'Kanban', icon: <KanbanSquareIcon />, url: '/kanban' },
                { name: 'Calendar', icon: <CalendarIcon />, url: '/calendar' },
                { name: 'Todo List', icon: <ListIcon />, url: '/todo-list' },
              ].map((item, index) => {
                // Check if the pathname exactly matches the item.url or starts with the url followed by a slash
                const isActive = pathname === item.url || pathname.startsWith(`${item.url}/`);

                return (
                  <React.Fragment key={index}>
                    <SidebarMenuButton asChild isActive={isActive} className='mb-1'>
                      <Link href={item.url} onClick={() => setOpenMobile(false)}>
                        {item.icon}
                        <span>{item.name}</span>
                      </Link>
                    </SidebarMenuButton>
                  </React.Fragment>
                );
              })}
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarHistory user={user} />
      </SidebarContent>
      <SidebarFooter>{user && <SidebarUserNav user={user} />}</SidebarFooter>
    </Sidebar>
  );
}
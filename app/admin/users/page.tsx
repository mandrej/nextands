"use client";

import { useState, useEffect, useMemo } from "react";
import { getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { userCollection } from "../../helpers/collections";
import { MyUserType } from "../../helpers/models";
import { toast } from "sonner";
import {
  Users,
  Search,
  Edit2,
  Mail,
  ShieldCheck,
  ShieldX,
  BellRing,
  BellOff,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function UsersPage() {
  const [users, setUsers] = useState<MyUserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [editingUser, setEditingUser] = useState<MyUserType | null>(null);
  const [editData, setEditData] = useState({ name: "", nick: "" });
  const [nickError, setNickError] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const q = query(userCollection, orderBy("timestamp", "desc"));
      const snap = await getDocs(q);
      const list = snap.docs.map((doc) => ({
        ...(doc.data() as MyUserType),
        uid: doc.id,
      }));
      setUsers(list);
    } catch (error) {
      console.error("Error fetching users:", error);
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter(
      (u) =>
        (u.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.email || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.nick || "").toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [users, searchTerm]);

  const toggleStatus = async (
    user: MyUserType,
    field: "isAdmin" | "isAuthorized",
  ) => {
    setIsUpdating(true);
    const newVal = !user[field];
    try {
      await updateDoc(doc(userCollection, user.uid), { [field]: newVal });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, [field]: newVal } : u)),
      );
      toast.success(`${user.email} updated`);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error(`Failed to update ${field}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleUpdateInfo = async () => {
    if (!editingUser) return;

    const trimmedNick = editData.nick.trim();
    if (trimmedNick) {
      const conflict = users.find(
        (u) =>
          u.uid !== editingUser.uid &&
          (u.nick || "").toLowerCase() === trimmedNick.toLowerCase(),
      );
      if (conflict) {
        setNickError(
          `"@${trimmedNick}" is already taken by ${conflict.name || conflict.email}`,
        );
        return;
      }
    }
    setNickError(null);

    setIsUpdating(true);
    try {
      const payload = { ...editData, nick: trimmedNick };
      await updateDoc(doc(userCollection, editingUser.uid), payload);
      setUsers((prev) =>
        prev.map((u) => (u.uid === editingUser.uid ? { ...u, ...payload } : u)),
      );
      toast.success("User profile updated");
      setEditingUser(null);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
    } catch (error) {
      toast.error("Failed to update profile");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="w-full space-y-6 pb-20 text-foreground">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h3 className="text-xl font-bold tracking-tight flex items-center gap-2 px-1">
          <Users className="h-5 w-5 text-primary" />
          User Management
        </h3>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 bg-card border-border"
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-xl bg-card border border-border shadow-sm">
        {loading ? (
          <div className="p-20 text-center">
            <Loader2 className="size-8 animate-spin text-primary mx-auto" />
            <p className="mt-4 text-muted-foreground font-medium">
              Fetching secure records...
            </p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <ul className="divide-y divide-border">
            {filteredUsers.map((user) => (
              <li
                key={user.uid}
                className="px-6 py-5 flex flex-col md:flex-row md:items-center justify-between hover:bg-accent/30 transition-colors gap-4"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={cn(
                      "size-12 rounded-full flex items-center justify-center font-bold text-lg border-2",
                      user.isAdmin
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted text-muted-foreground border-transparent",
                    )}
                  >
                    {user.name?.[0]?.toUpperCase() ||
                      user.email?.[0]?.toUpperCase() ||
                      "?"}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-foreground tracking-tight">
                        {user.name || "System User"}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" /> {user.email}
                      </span>
                      {user.nick && (
                        <span className="flex items-center gap-1 font-mono font-medium text-[10px] bg-accent/50 px-1 rounded truncate max-w-[120px]">
                          @{user.nick}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 bg-muted/20 p-1 rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 gap-2 text-[11px] font-bold uppercase tracking-tight rounded-md transition-all",
                      user.isAdmin
                        ? "text-primary hover:text-primary hover:bg-primary/10"
                        : "text-muted-foreground opacity-60",
                    )}
                    onClick={() => toggleStatus(user, "isAdmin")}
                    disabled={isUpdating}
                  >
                    {user.isAdmin ? (
                      <ShieldCheck className="size-3.5" />
                    ) : (
                      <ShieldX className="size-3.5" />
                    )}
                    Admin
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    className={cn(
                      "h-8 gap-2 text-[11px] font-bold uppercase tracking-tight rounded-md transition-all",
                      user.isAuthorized
                        ? "text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        : "text-green-500 hover:text-green-600 hover:bg-green-500/10",
                    )}
                    onClick={() => toggleStatus(user, "isAuthorized")}
                    disabled={isUpdating}
                  >
                    {user.isAuthorized ? (
                      <BellOff className="size-3.5" />
                    ) : (
                      <BellRing className="size-3.5" />
                    )}
                    {user.isAuthorized ? "Block" : "Allow"}
                  </Button>

                  <div className="w-px h-4 bg-border mx-1" />

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted"
                    onClick={() => {
                      setEditingUser(user);
                      setEditData({
                        name: user.name || "",
                        nick: user.nick || "",
                      });
                      setNickError(null);
                    }}
                    disabled={isUpdating}
                  >
                    <Edit2 className="size-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <div className="p-20 text-center space-y-3">
            <div className="size-16 rounded-full bg-muted mx-auto flex items-center justify-center mb-2">
              <Users className="size-8 text-muted-foreground/30" />
            </div>
            <p className="text-muted-foreground font-medium">
              No system occupants found.
            </p>
          </div>
        )}
      </div>

      <Dialog
        open={editingUser !== null}
        onOpenChange={(open) => !open && setEditingUser(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit2 className="size-5 text-primary" />
              Edit Profile Details
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Full Name
              </label>
              <Input
                value={editData.name}
                onChange={(e) =>
                  setEditData((prev) => ({ ...prev, name: e.target.value }))
                }
                placeholder="Name..."
                className="bg-muted/30 focus-visible:ring-primary"
                disabled={isUpdating}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Nickname
              </label>
              <Input
                value={editData.nick}
                onChange={(e) => {
                  setEditData((prev) => ({ ...prev, nick: e.target.value }));
                  setNickError(null);
                }}
                placeholder="Nick..."
                className={cn(
                  "bg-muted/30 focus-visible:ring-primary font-mono",
                  nickError && "border-red-500 focus-visible:ring-red-500",
                )}
                disabled={isUpdating}
              />
              {nickError && (
                <p className="text-xs text-red-500 ml-1 mt-1">{nickError}</p>
              )}
            </div>
            {editingUser && (
              <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                <Mail className="size-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground truncate">
                  {editingUser.email}
                </span>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => setEditingUser(null)}
              disabled={isUpdating}
              className="rounded-lg"
            >
              Cancel
            </Button>
            <Button
              onClick={handleUpdateInfo}
              disabled={isUpdating}
              className="rounded-lg px-6 shadow-lg shadow-primary/10"
            >
              {isUpdating ? (
                <Loader2 className="size-4 animate-spin mr-2" />
              ) : (
                <CheckCircle2 className="size-4 mr-2" />
              )}
              {isUpdating ? "Saving..." : "Update System Profile"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
